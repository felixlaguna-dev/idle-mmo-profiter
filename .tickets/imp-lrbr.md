---
id: imp-lrbr
status: closed
deps: [imp-puac, imp-khia, imp-pcda]
links: []
created: 2026-03-03T16:11:37Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-wx12
---
# Phase 4: Add missing test coverage

Add tests that are currently missing for edge cases in the low-confidence feature.

Steps:
1. In src/tests/calculators/craftableCalculator.test.ts, add a new describe block for vendor material exclusion:

   a. Test: "should NOT mark craftable as low-confidence when material is vendor-sold (vendorValue > 0) even if material has no lastSaleAt"
      - Create craftable with recent lastSaleAt
      - Create material with no lastSaleAt but vendorValue > 0 in materialVendorValueMap
      - Expect isLowConfidence = false (vendor materials excluded from confidence check)
   
   b. Test: "should mark craftable as low-confidence when non-vendor material has stale sales, even if vendor material is fine"
      - Create craftable with 2 materials: one vendor-sold (vendorValue > 0), one non-vendor with stale lastSaleAt
      - Expect isLowConfidence = true (the non-vendor material triggers it)
   
   c. Test: "should work correctly with materialVendorValueMap=undefined (backwards compatibility)"
      - Call calculateCraftableProfits without materialVendorValueMap parameter
      - Ensure it still checks materials if materialLastSaleAtMap is provided
      - Verify no crashes, correct behavior

2. Run full test suite to verify all tests pass after Phase 1-3 refactors

## Acceptance Criteria

- Vendor material exclusion test passes: vendor-sold materials (vendorValue > 0) do NOT trigger low-confidence
- Mixed vendor/non-vendor test passes: non-vendor stale material still triggers low-confidence
- Backwards compatibility test passes: missing materialVendorValueMap parameter handled gracefully
- All existing tests still pass after Phase 1-3 refactors
- Full test suite green

