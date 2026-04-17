import asyncio
import logging
import sys
from unittest.mock import MagicMock

# 1. Mock the missing 'blake3' to allow imports
sys.modules['blake3'] = MagicMock()

# 2. Add /root/arifOS to sys.path
sys.path.append("/root/arifOS")

# 3. Mock the organs entirely for the loop logic test
mock_organs = MagicMock()
sys.modules['core.organs'] = mock_organs
sys.modules['core.organs._0_init'] = mock_organs
sys.modules['core.organs._1_agi'] = mock_organs
sys.modules['core.organs._2_asi'] = mock_organs
sys.modules['core.organs._3_apex'] = mock_organs
sys.modules['core.organs._4_vault'] = mock_organs

from core.shared.types import Verdict
from core.kernel.planner import Planner
from core.kernel.loop_controller import SabarLoopController, LoopStepResult

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("arifOS.Sim")

class MockSabarLoop(SabarLoopController):
    def __init__(self, scenario="clean", **kwargs):
        super().__init__(**kwargs)
        self.scenario = scenario
        self.step_count = 0

    async def step(self, task, plan):
        self.step_count += 1
        
        if self.scenario == "clean":
            return LoopStepResult(task.id, Verdict.SEAL, {"data": "ok"}, 0.01)

        if self.scenario == "sabar_repair":
            if "RETRY" not in task.description:
                return LoopStepResult(task.id, Verdict.SABAR, None, 0.0, "Input vague")
            else:
                return LoopStepResult(task.id, Verdict.SEAL, {"data": "fixed"}, 0.01)

        if self.scenario == "entropy_runaway":
            # Rising entropy: 0.01 -> 0.02 -> 0.04 (Total > 0.05 threshold)
            deltas = [0.01, 0.02, 0.04]
            delta = deltas[self.step_count - 1] if self.step_count <= len(deltas) else 0.05
            return LoopStepResult(task.id, Verdict.SEAL, {"data": "ok"}, delta)

        if self.scenario == "888_hold":
            return LoopStepResult(task.id, Verdict.HOLD, None, 0.0, "Security Violation")

        return LoopStepResult(task.id, Verdict.VOID, None, 0.0, "Unknown scenario")

async def run_simulation(scenario_name):
    print(f"\n🚀 --- SIMULATION SCENARIO: {scenario_name} ---")
    planner = Planner()
    plan = planner.create_plan(f"Simulation: {scenario_name}")
    
    t1 = planner.add_task(plan.id, "Step 1: Intake")
    t2 = planner.add_task(plan.id, "Step 2: Process", dependencies=[t1])
    t3 = planner.add_task(plan.id, "Step 3: Export", dependencies=[t2])

    loop = MockSabarLoop(scenario=scenario_name, max_iterations=5, entropy_threshold=0.05)
    result = await loop.run(plan, planner)

    print(f"Outcome: {result.status}")
    print(f"Iterations: {result.iterations}")
    print(f"Final Entropy: {result.final_entropy:.4f}")
    
    for tid in [t1, t2, t3]:
        task = plan.tasks[tid]
        print(f"  Task {tid}: {task.status}")

async def main():
    scenarios = ["clean", "sabar_repair", "entropy_runaway", "888_hold"]
    for s in scenarios:
        await run_simulation(s)

if __name__ == "__main__":
    asyncio.run(main())
