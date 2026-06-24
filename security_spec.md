# Security Specification - Sistema de Préstamos Indexados

## Data Invariants
1. A Loan must belong to a valid Worker.
2. Only Admins can approve or reject loans.
3. Workers can only see their own loans and payments.
4. Admins can see all loans and payments.
5. Payments must be linked to a Loan.
6. The `amountForeign` in a Payment must be correctly calculated based on `amountBs` / `rateApplied` (though rules can't do complex math easily, we can enforce identity checks).
7. `createdAt` and `ownerId` (workerId) must be immutable.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: Worker A tries to create a loan for Worker B.
2. **Privilege Escalation**: Worker tries to set their role to 'admin'.
3. **State Shortcutting**: Worker tries to create a loan already in 'approved' status.
4. **Unauthorized Approval**: Worker tries to update a loan status to 'approved'.
5. **Ghost Field Injection**: Adding `isVerified: true` to a Loan document.
6. **Data Injection**: Injecting 1MB string into a `guaranteeInfo` field.
7. **Cross-User Read**: Worker A tries to read Worker B's loan.
8. **Resource Poisoning**: Use invalid characters in document ID.
9. **PII Leak**: Worker A tries to read Worker B's worker profile.
10. **Immutable Field Update**: Worker tries to change the `workerId` of an existing loan.
11. **Self-Assigned Rate**: Worker tries to create a loan with a fake `rateAtAgreement`.
12. **Future Timestamp**: Setting `createdAt` to a future date.

## Test Runner (Draft)
A `firestore.rules.test.ts` will verify these denials.
