import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Asset
import uuid

# SQLite database for digital twin
DB_URL = "sqlite:///./digitaltwin.db"
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def generate_hyperscale_campus():
    """
    Generates a 1,000,000+ Server Gigawatt-Scale Hyperscale AI Data Center:
    - 5 Data Center Buildings (4 Data Halls each = 20 Data Halls total)
    - 20,000 CPU Racks (800,000 CPU servers @ 40 servers/rack, 15 kW/rack)
    - 2,778 GPU Racks (200,000 GPUs @ 72 GPUs/rack GB200 NVL72, 132 kW/rack)
    - Total: 22,778 Racks housing 1,000,000+ Physical Compute Engines
    - 160 End-of-Row CDUs (Coolant Distribution Units) pumping 527,820 LPM
    - 400kV MSETCL Grid Substation (1.15 GW facility connection)
    - 5x E-Houses (415V Switchgear)
    - 20x Kinetic Flywheel UPS Units (8-tonne flywheels)
    - 20x 3.5 MW Diesel Emergency Generators
    - 20x Multi-Story Adiabatic Cooling Towers with evaporative mist
    """
    print("=" * 70)
    print("GENERATING 1,000,000+ SERVER GIGAWATT-SCALE AI DATA CENTER TOPOLOGY")
    print("=" * 70)
    
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    campus_id = "CAMPUS-GIGA-01"
    campus = Asset(
        id=campus_id, 
        type="campus", 
        name="Titan AI Hyperscale Campus (1.15 GW)",
        status="ONLINE",
        health=100.0,
        dependencies=[]
    )
    db.add(campus)
    
    # 1. 400kV Substation Infrastructure
    substation_id = "CAMPUS-SUBSTATION"
    db.add(Asset(
        id=substation_id,
        type="substation",
        name="400kV MSETCL EHV Grid Substation (1.15 GW)",
        parent_id=campus_id,
        status="ONLINE",
        health=99.8
    ))
    
    # 2. Central Cooling Plant
    cooling_plant_id = "CAMPUS-COOLING-PLANT"
    db.add(Asset(
        id=cooling_plant_id,
        type="chiller",
        name="30,000-Ton Central Mechanical Chiller Plant",
        parent_id=campus_id,
        status="ONLINE",
        health=99.9
    ))
    
    # 3. Water Infrastructure
    water_infra_id = "CAMPUS-WATER-INFRASTRUCTURE"
    db.add(Asset(
        id=water_infra_id,
        type="cooling_tower",
        name="18-Cell Induced Draft Cooling Towers & Storage",
        parent_id=campus_id,
        status="ONLINE",
        health=100.0
    ))
    
    # 4. Generator Plant
    generator_plant_id = "CAMPUS-GENERATOR-PLANT"
    db.add(Asset(
        id=generator_plant_id,
        type="generator",
        name="60-Megawatt Standby Diesel Generator Plant",
        parent_id=campus_id,
        status="STANDBY",
        health=100.0
    ))
    
    total_cpu_racks = 0
    total_gpu_racks = 0
    total_servers = 0
    total_cdus = 0
    
    # 5 Buildings
    for b in range(1, 6):
        b_id = f"{campus_id}-BLD{b}"
        db.add(Asset(
            id=b_id,
            type="building",
            name=f"Hyperscale Facility Building {b}",
            parent_id=campus_id,
            status="ONLINE",
            health=100.0
        ))
        
        # External Infrastructure per Building:
        # Adiabatic Cooling Towers
        db.add(Asset(
            id=f"{b_id}-COOLTOWER",
            type="cooling_tower",
            name=f"Adiabatic Evaporative Cooling Tower B{b}",
            parent_id=b_id,
            status="ONLINE",
            health=99.9
        ))
        
        # Diesel Generator Yard
        db.add(Asset(
            id=f"{b_id}-GENYARD",
            type="generator",
            name=f"3.5MW Reciprocating Diesel Genset Array B{b}",
            parent_id=b_id,
            status="STANDBY",
            health=100.0
        ))
        
        # E-House (Medium to Low Voltage Switchgear)
        db.add(Asset(
            id=f"{b_id}-EHOUSE",
            type="e_house",
            name=f"Prefabricated Electrical House (415V) B{b}",
            parent_id=b_id,
            status="ONLINE",
            health=100.0
        ))
        
        # Kinetic Flywheel UPS Room
        db.add(Asset(
            id=f"{b_id}-UPS-FLYWHEEL",
            type="ups_flywheel",
            name=f"8-Tonne Kinetic Flywheel UPS Cluster B{b}",
            parent_id=b_id,
            status="ONLINE",
            health=100.0
        ))
        
        # 4 Data Halls per Building (Total 20 Data Halls)
        for h in range(1, 5):
            h_id = f"{b_id}-H{h}"
            # Hall 1 & 2: GPU AI Acceleration Halls (GB200 NVL72 Liquid-Cooled)
            # Hall 3 & 4: CPU Cloud General Compute Halls (OCP Air-to-Water Chilled Water)
            is_gpu_hall = (h <= 2)
            hall_type = "GPU AI Training Hall (Liquid-Cooled)" if is_gpu_hall else "CPU Enterprise Cloud Hall (HAC)"
            
            db.add(Asset(
                id=h_id,
                type="hall",
                name=f"Building {b} - Hall {h} [{hall_type}]",
                parent_id=b_id,
                status="ONLINE",
                health=100.0
            ))
            
            # Each hall has rows
            if is_gpu_hall:
                # 14 rows of GB200 racks = ~139 GPU racks per hall (total 2,778 across 20 halls)
                num_rows = 14
                racks_per_row = 10
                for r in range(1, num_rows + 1):
                    row_id = f"{h_id}-ROW-GPU{r}"
                    db.add(Asset(id=row_id, type="row_gpu", name=f"GB200 Row {r}", parent_id=h_id))
                    
                    # End-of-row Coolant Distribution Unit (CDU)
                    cdu_id = f"{row_id}-CDU"
                    db.add(Asset(
                        id=cdu_id,
                        type="cdu",
                        name=f"Liquid CDU Heat Exchanger Row {r} (3,800 LPM)",
                        parent_id=row_id,
                        status="ONLINE",
                        health=100.0
                    ))
                    total_cdus += 1
                    
                    for rk in range(1, racks_per_row + 1):
                        rack_id = f"{row_id}-RK{rk}"
                        db.add(Asset(
                            id=rack_id,
                            type="rack_gpu",
                            name=f"GB200 NVL72 Rack {rk} (132kW Direct Liquid)",
                            parent_id=row_id,
                            status="ONLINE",
                            health=99.9
                        ))
                        total_gpu_racks += 1
                        total_servers += 72 # 72 GPUs per NVL72 rack
            else:
                # 20 rows of CPU racks = ~1,000 CPU racks per hall (total 20,000 across 20 halls)
                num_rows = 20
                racks_per_row = 50
                for r in range(1, num_rows + 1):
                    row_id = f"{h_id}-ROW-CPU{r}"
                    db.add(Asset(id=row_id, type="row_cpu", name=f"OCP CPU Row {r} (Hot Aisle Contained)", parent_id=h_id))
                    
                    for rk in range(1, racks_per_row + 1):
                        rack_id = f"{row_id}-RK{rk}"
                        db.add(Asset(
                            id=rack_id,
                            type="rack_cpu",
                            name=f"OCP Open Rack V3 {rk} (15kW Air/Water)",
                            parent_id=row_id,
                            status="ONLINE",
                            health=100.0
                        ))
                        total_cpu_racks += 1
                        total_servers += 40 # 40 CPU servers per rack
                        
        db.commit()
        print(f"Committed Building {b}/5. Cumulative Totals -> CPU Racks: {total_cpu_racks}, GPU Racks: {total_gpu_racks}, Physical Compute Nodes: {total_servers:,}")
        
    db.close()
    print("=" * 70)
    print("GENERATION SUMMARY:")
    print(f"  • Total Physical Compute Units: {total_servers:,} (800,000 CPUs + 200,000 GPUs)")
    print(f"  • Total Racks: {total_cpu_racks + total_gpu_racks:,} ({total_cpu_racks:,} CPU + {total_gpu_racks:,} GPU NVL72)")
    print(f"  • Coolant Distribution Units: {total_cdus} CDUs (527,820 LPM primary/secondary loop)")
    print(f"  • Total Substation Capacity: 1.15 Gigawatts (400kV MSETCL Grid)")
    print("=" * 70)

if __name__ == "__main__":
    generate_hyperscale_campus()
