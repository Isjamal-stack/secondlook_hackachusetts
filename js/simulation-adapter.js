/** Person C: load this module AFTER the app has initialized (see PART_A_HANDOFF.md). */
import { createSimulation } from './simulation.js';
export function installSimulation(ui = window.secondLookUI) {
    if (!ui?.configure) throw new Error('Load the SecondLook dashboard before installing its simulator.');
    ui.configure({ createSimulation });
}
