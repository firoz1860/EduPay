
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const APPLY = process.env.CLEANUP_APPLY === 'true';
const PURGE_STUDENTS = process.env.CLEANUP_STUDENTS === 'true';
const PURGE_CONFIG = process.env.CLEANUP_CONFIG === 'true';

async function main() {
  const steps = [
    'notification',
    'auditLog',
    'ledgerEntry',
    'reconciliationRecord',
    'gatewayEvent',
    'idempotencyKey',
    'paymentAttempt',
    'refund',
    'payment',
    'installment',
    'invoiceItem',
    'invoice',
  ];
  if (PURGE_STUDENTS) steps.push('student');
  if (PURGE_CONFIG) steps.push('feeStructureItem', 'feeStructure', 'course', 'feeHead', 'department');

  console.log(APPLY ? '=== APPLYING DELETIONS ===' : '=== DRY RUN (no deletions) ===');
  const preserved = ['users (all logins, incl. real accounts)', 'schema', 'migrations'];
  if (!PURGE_STUDENTS) preserved.push('students');
  if (!PURGE_CONFIG) preserved.push('reference config (departments/courses/feeHeads/feeStructures)');
  console.log('Preserving:', preserved.join(', '));
  console.log('');

  let total = 0;
  for (const name of steps) {
    const count = await p[name].count();
    total += count;
    if (APPLY) {
      const res = await p[name].deleteMany();
      console.log(`deleted ${String(res.count).padStart(4)}  ${name}`);
    } else {
      console.log(`would delete ${String(count).padStart(4)}  ${name}`);
    }
  }

  const users = await p.user.count();
  console.log('');
  console.log(`${APPLY ? 'Removed' : 'Would remove'} ${total} demo record(s). Preserved ${users} user(s).`);
  if (!APPLY) console.log('Re-run with CLEANUP_APPLY=true to apply.');
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', String(e.message).split('\n')[0]);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
