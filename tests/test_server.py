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


if __name__ == '__main__':
    unittest.main()
