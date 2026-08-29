## REMOVED Requirements

### Requirement: Dynamic Documentation Specification Rewriting and Fallback Routing
**Reason**: Downstream microservices (Auth, Product, Order, User) now natively serve relative specification URLs (`./openapi.yaml`, `./openapi.json`), rendering gateway-level in-flight HTML string rewriting (`sub_filter`) and root fallback aliases (`/docs/openapi.yaml`, `/openapi.json`) obsolete.
**Migration**: Upstream services resolve documentation assets relative to their mounted gateway prefix (`/docs/<service>/`). Clients and interactive UIs access specifications directly via `/docs/<service>/openapi.yaml` or `/docs/<service>/openapi.json`.
