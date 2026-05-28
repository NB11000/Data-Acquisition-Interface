# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual tag strings used in this repo's local-markdown issue tracker.

| Role | Tag string | Meaning |
| ---- | ---------- | ------- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), add or update a `Status:` line in the issue file's frontmatter using the corresponding tag string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.
