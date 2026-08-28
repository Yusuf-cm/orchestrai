import 'dotenv/config';
import { loadWorkflows } from '../services/workflow/loader';
import { registerAdapter } from '../adapters/registry';
import { GovernmentAdapter } from '../adapters/government';
import { HealthcareAdapter } from '../adapters/healthcare';
import { startCase } from '../services/case-service';
import { prisma } from '../db/prisma';

async function smoke() {
  loadWorkflows();
  registerAdapter(new GovernmentAdapter());
  registerAdapter(new HealthcareAdapter());

  console.log('🧪 Smoke test: starting gov case...');
  const govCase = await startCase('I lost my California driver license');
  console.log('✅ Gov case:', govCase.id, govCase.title, govCase.workflow.currentStepId);
  console.log('   Requirements:', govCase.requirements.length);
  console.log('   Readiness:', govCase.state.readinessScore + '%');

  console.log('🧪 Smoke test: starting health case...');
  const healthCase = await startCase('My knee has been hurting for 3 weeks when I run');
  console.log('✅ Health case:', healthCase.id, healthCase.title, healthCase.workflow.currentStepId);
  console.log('   Care level:', healthCase.workflow.slots.care_level);

  await prisma.$disconnect();
  console.log('✅ Smoke test passed');
}

smoke().catch((e) => {
  console.error('❌ Smoke test failed:', e);
  process.exit(1);
});
