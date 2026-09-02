# Technology Architecture

## Chosen Technologies & Rationale

### Frontend Layer
- **Language**: TypeScript (Strict typing for complex digital twin models)
- **Framework**: React via Vite (High performance, modern HMR, fast builds)
- **State Management**: Zustand (Minimal boilerplate, high performance for frequent state updates without re-rendering the whole tree)
- **Data Fetching**: TanStack Query (Server state management, caching)
- **Styling**: Tailwind CSS + shadcn/ui (Professional, utility-first styling for quick, consistent UI development)
- **Icons**: Lucide Icons (Clean, modern iconography)

### 3D Rendering Engine
- **Core**: Three.js + React Three Fiber (@react-three/fiber)
- **Helpers**: Drei (@react-three/drei)
- **Optimization Strategy**: 
  - `InstancedMesh` for rendering thousands of identical racks/servers in a single draw call.
  - Frustum culling and spatial partitioning (Octree/BVH) to omit off-screen geometry.
  - Level-of-Detail (LOD) components to dynamically switch between low-poly bounding boxes (Campus view) and high-poly detailed meshes (Rack/Server view).

### Backend API & Simulation Layer
- **Language**: Python 3.11+
- **Framework**: FastAPI (High performance, async native, auto-generated OpenAPI docs)
- **Real-time Communication**: WebSockets via FastAPI (For live telemetry pushing and event streaming)
- **Dependency Graph Analysis**: NetworkX (Modeling power grids and network topologies for failure propagation)
- **Data Validation**: Pydantic (Strongly typed schemas)

### Database & Caching
- **Primary Database**: PostgreSQL (Relational integrity for assets: Campuses, Buildings, Halls, Racks, Servers)
- **Time-Series DB**: TimescaleDB (Extension on PostgreSQL for high-volume telemetry ingestion and querying)
- **Cache & Message Broker**: Redis (Used for maintaining the real-time simulation state cache and passing messages via Redis Streams/PubSub)

### Infrastructure & Operations
- **Containerization**: Docker & Docker Compose (Easy orchestration of frontend, backend, pg, redis)
- **Monorepo Management**: npm workspaces or Turborepo (Structuring apps and packages)

## Alternatives Considered

- **Single HTML + Vanilla JS**: Rejected as it scales poorly for complex engineering apps and violates requirement #45.
- **Go Backend**: Considered for high-throughput WebSockets, but Python + FastAPI + NetworkX provides a better ecosystem for simulation, math, and graph modeling while still handling the required concurrency easily.
- **DuckDB-Wasm**: Considered for client-side analytics. We will incorporate this if offline analytics on large generated datasets is requested later, but TimescaleDB + PostgreSQL is better for the core real-time transactional and time-series backend.

## Performance & Scalability Implications

- **10,000+ Servers**: The backend uses procedural generation to populate PostgreSQL with 10,000+ logical assets. The simulation engine runs in Python, calculating state and faults in memory, and syncing to Redis.
- **Rendering**: The frontend *never* requests or renders 10,000 detailed server meshes. It queries the spatial index and uses `InstancedMesh`. At campus level, it renders single boxes per hall. At hall level, it renders instanced boxes for racks. 
- **Data Flow**: 
  - Database (Static Assets) → FastAPI (API) → React (UI)
  - Simulation Engine (Python) → Redis (State/Events) → FastAPI (WebSockets) → React (Zustand) → Three.js (Visual updates)

## Deployment Architecture

```text
[ Docker Compose ]
 ├── web (Vite React SPA, Nginx)
 ├── api (FastAPI Uvicorn)
 ├── worker (Python Simulation Engine)
 ├── db (PostgreSQL + TimescaleDB)
 └── cache (Redis)
```
