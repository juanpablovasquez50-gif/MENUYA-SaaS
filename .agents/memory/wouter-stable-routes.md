---
name: Stable Wouter route elements
description: Avoid route remount loops and state loss during parent data updates.
---

When a Wouter route receives a newly created inline component function, parent re-renders can make it a new component type and remount the page. Use stable component types or stable JSX children when route content depends on mutable parent state.

**Why:** In MENUYA, recording a catalog visit updated parent state; route remounts repeated the effect and discarded the visitor's in-progress product selection.

**How to apply:** In a `Switch`, avoid `component={() => <Page ... />}` wrappers around data-driven pages. Prefer stable route children or declared component functions, and check that effects which write parent state cannot retrigger from remounts.
