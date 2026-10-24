"""Focused regressions for the integrated demo; no live API key needed."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import server
from ai_provider import build_explanation_prompt, generate_openai_explanation


def event(condition='normal_warmup'):
    return {
        'event_id': 'regression-' + condition,
        'scenario_id': 'normal-warmup', 'condition': condition,
        'urgency': 'normal' if condition == 'normal_warmup' else 'attention',
        'evidence': [{'metric': 'coolant_c', 'start_value': 90, 'end_value': 90, 'duration_s': 10}],
        'approved_next_step': 'Keep watching the temperature.',
        'limitations': ['Simulated prototype rules.', 'Mechanical cause is unknown.']
    }


class DemoServerTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        server.processed_events.clear()

    def test_private_files_are_blocked_even_when_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            (root / 'server').mkdir()
            (root / 'server' / '.env').write_text('DUMMY_SECRET=not-a-real-key')
            (root / 'server' / 'server.py').write_text('# private source')
            (root / 'index.html').write_text('<h1>Public demo</h1>')
            (root / 'js').mkdir()
            (root / 'js' / 'app.js').write_text('// public asset')
            (root / 'js' / '.env.js').write_text('private')
            with patch.object(server, 'FRONTEND_DIR', root):
                for path in ['/server/.env', '/server/server.py', '/.git/config',
                             '/STARTUP.md', '/js/.env.js', '/js/../server/.env', '/missing.js']:
                    with self.subTest(path=path):
                        self.assertEqual(self.client.get(path).status_code, 404)
                for path in ['/', '/index.html', '/js/app.js?v=fresh']:
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, 200)
                    response.close()

    def test_normal_explanation_matches_stable_window(self):
        with patch.object(server, 'AI_PROVIDER', 'none'):
            response = self.client.post('/api/explain', json=event())
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['event_id'], event()['event_id'])
        self.assertEqual(data['next_step'], event()['approved_next_step'])
        self.assertEqual(data['explanation_source'], 'template')
        self.assertIn('steady', data['explanation'])
        self.assertNotIn('circulating', data['explanation'])
        self.assertNotIn('cold start', data['explanation'])
        self.assertIn('90°C', data['explanation'])
        self.assertIn('10 seconds', data['explanation'])

    def test_ai_failure_keeps_action_and_returns_honest_fallback(self):
        sample = event('sustained_temperature_rise')
        sample['evidence'][0].update(start_value=93, end_value=103, duration_s=12)
        with patch.object(server, 'AI_PROVIDER', 'openai'), patch.object(
                server, 'generate_ai_explanation', side_effect=TimeoutError('test timeout')):
            data = self.client.post('/api/explain', json=sample).get_json()
        self.assertEqual(data['explanation_source'], 'template')
        self.assertEqual(data['next_step'], sample['approved_next_step'])
        self.assertIn('93°C to 103°C over 12 seconds', data['explanation'])
        self.assertNotIn('above the normal operating range', data['explanation'])

    def test_invalid_request_is_rejected(self):
        for value in [{}, [], ['invalid'], 'invalid']:
            self.assertEqual(self.client.post('/api/explain', json=value).status_code, 400)

    def test_prompt_preserves_units_action_and_limits(self):
        prompt = build_explanation_prompt(event())
        self.assertIn('°C', prompt)
        self.assertIn(event()['approved_next_step'], prompt)
        for limitation in event()['limitations']:
            self.assertIn(limitation, prompt)
        self.assertIn('simulation', prompt)

    def test_model_adapter_preserves_contract_and_disables_retries(self):
        client = MagicMock()
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='The observed temperature stayed steady.'))])
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'dummy-test-key'}), patch(
                'openai.OpenAI', return_value=client) as factory:
            data = generate_openai_explanation(event(), 5000)
        self.assertEqual(data['event_id'], event()['event_id'])
        self.assertEqual(data['next_step'], event()['approved_next_step'])
        self.assertEqual(data['explanation_source'], 'ai')
        self.assertEqual(factory.call_args.kwargs['max_retries'], 0)
        self.assertEqual(factory.call_args.kwargs['timeout'], 5)
        client.close.assert_called_once()


class ReviewRegressions(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        server.processed_events.clear()

    def output(self, sample, text):
        from template_explanations import generate_template_explanation
        result = generate_template_explanation(sample)
        result.update(explanation=text, explanation_source='ai')
        return result

    def post_model(self, sample, output):
        with patch.object(server, 'AI_PROVIDER', 'openai'), patch.object(
                server, 'generate_ai_explanation', return_value=output):
            return self.client.post('/api/explain', json=sample)

    def test_review_live_phrases_use_prepared_fallback(self):
        # Reproduce the actual unsupported claims quoted in FULL_TEST_REVIEW.md.
        cases = [
            ('sustained_temperature_rise', 'The engine is getting hotter than normal.'),
            ('normal_warmup', 'The engine is warming up normally in a typical range, and the cooling system is managing temperature effectively.'),
            ('normal_warmup', 'The engine is warming up.'),
            ('normal_warmup', 'The temperature is in a typical range.'),
            ('normal_warmup', 'The cooling system is managing temperature effectively.'),
            ('normal_warmup', 'The cooling system is working.'),
            ('normal_warmup', 'Your car is healthy.'),
            ('normal_warmup', 'The observed temperature is 95 degrees.'),
            ('normal_warmup', 'The temperature is ninety degrees.'),
        ]
        from template_explanations import generate_template_explanation
        for index, (condition, text) in enumerate(cases):
            sample = event(condition)
            sample['event_id'] = f'wording-{index}'
            if condition == 'sustained_temperature_rise':
                sample['evidence'][0].update(start_value=92, end_value=100)
            with self.subTest(text=text):
                response = self.post_model(sample, self.output(sample, text))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.get_json(), generate_template_explanation(sample))

    def test_grounded_qualitative_prose_is_accepted(self):
        for condition, text in [
            ('normal_warmup', 'Temperature stayed steady in this observed window. This does not establish the mechanical cause.'),
            ('sustained_temperature_rise', 'Temperature continued to rise during this observed window. The readings do not identify the cause.')
        ]:
            sample = event(condition)
            if condition == 'sustained_temperature_rise':
                sample['evidence'][0].update(start_value=92, end_value=100)
            data = self.post_model(sample, self.output(sample, text)).get_json()
            self.assertEqual(data['explanation_source'], 'ai')
            self.assertEqual(data['explanation'], text)
            self.assertEqual(data['next_step'], sample['approved_next_step'])
            self.assertEqual(data['limitation'], ' '.join(sample['limitations']))

    def test_malformed_requests_return_400_before_model(self):
        cases = [dict(urgency='banana'), dict(evidence=[42]), dict(limitations=42),
                 dict(evidence=[]), dict(limitations=['', 42]), dict(observed_at_ms=True)]
        for field, value in [('duration_s', -1), ('duration_s', float('nan')),
                             ('start_value', float('inf')), ('end_value', True), ('metric', 'mystery')]:
            evidence = dict(event()['evidence'][0], **{field: value})
            cases.append(dict(evidence=[evidence]))
        with patch.object(server, 'generate_ai_explanation') as model:
            for change in cases:
                with self.subTest(change=change):
                    self.assertEqual(self.client.post('/api/explain', json=dict(event(), **change)).status_code, 400)
            model.assert_not_called()

    def test_unknown_event_can_have_empty_evidence(self):
        sample = dict(event(), condition='data_unavailable', urgency='unknown', evidence=[])
        with patch.object(server, 'AI_PROVIDER', 'none'):
            response = self.client.post('/api/explain', json=sample)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['explanation_source'], 'template')

    def test_faulty_provider_contract_uses_prepared_fallback(self):
        sample = event()
        from template_explanations import generate_template_explanation
        good = self.output(sample, 'The temperature stayed steady in this observed window.')
        bad_outputs = [None, [], dict(good, event_id='wrong-id'), dict(good, next_step='Replace the radiator.'),
                       dict(good, limitation='Different uncertainty.'), {k: v for k, v in good.items() if k != 'limitation'}]
        for output in bad_outputs:
            server.processed_events.clear()
            with self.subTest(output=output):
                response = self.post_model(sample, output)
                self.assertEqual(response.get_json(), generate_template_explanation(sample))

    def test_same_id_different_evidence_or_action_does_not_reuse_cache(self):
        sample = event()
        changed = dict(sample, condition='sustained_temperature_rise', urgency='attention',
                       evidence=[dict(sample['evidence'][0], end_value=108)],
                       approved_next_step='Check the vehicle handbook warning guidance.')
        with patch.object(server, 'AI_PROVIDER', 'none'):
            first = self.client.post('/api/explain', json=sample).get_json()
            second = self.client.post('/api/explain', json=changed).get_json()
        self.assertNotEqual(first['explanation'], second['explanation'])
        self.assertEqual(second['next_step'], changed['approved_next_step'])
        self.assertIn('108°C', second['explanation'])

    def test_identical_payload_uses_cache(self):
        sample = event()
        with patch.object(server, 'AI_PROVIDER', 'openai'), patch.object(
                server, 'generate_ai_explanation', return_value=self.output(sample, 'Temperature stayed steady in this observed window.')) as model:
            first = self.client.post('/api/explain', json=sample).get_json()
            second = self.client.post('/api/explain', json=sample).get_json()
            self.assertEqual(first, second)
            self.assertEqual(model.call_count, 1)


if __name__ == '__main__':
    unittest.main()
