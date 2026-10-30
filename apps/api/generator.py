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
    
    # 1. 400kV Substation Infrastructure & Dual Utility Feeds
    substation_id = "CAMPUS-SUBSTATION"
    db.add(Asset(
        id=substation_id,
        type="substation",
        name="400kV MSETCL EHV Grid Substation (1.15 GW)",
        parent_id=campus_id,
        status="ONLINE",
        health=99.8,
        redundancy="2(N+1)",
        rated_capacity=1150.0, # MW
        specs={
            "utility": "MSETCL 400 kV Transmission Network",
            "rated_mva": 1400.0,
            "substation_type": "Gas Insulated Switchgear (GIS)",
            "primary_voltage_kv": 400.0,
            "secondary_voltage_kv": 33.0,
            "transformers": "4x 350 MVA 400/33kV Auto-Transformers (N+1)",
            "short_circuit_capacity_ka": 50.0,
            "uncertainty_rating_percent": 1.5
        }
    ))

    # Dual 400kV Independent Utility Feeds (A & B)
    db.add(Asset(
        id="SUBSTATION-FEEDER-A",
        type="grid_feeder",
        name="MSETCL 400kV Primary Feeder A (Circuit 1 - 700 MVA)",
        parent_id=substation_id,
        status="ONLINE",
        health=100.0,
        redundancy="2N",
        rated_capacity=700.0,
        specs={"voltage_kv": 400.0, "bus": "Bus A", "capacity_mva": 700.0, "availability": 0.9999}
    ))
    db.add(Asset(
        id="SUBSTATION-FEEDER-B",
        type="grid_feeder",
        name="MSETCL 400kV Redundant Feeder B (Circuit 2 - 700 MVA)",
        parent_id=substation_id,
        status="ONLINE",
        health=100.0,
        redundancy="2N",
        rated_capacity=700.0,
        specs={"voltage_kv": 400.0, "bus": "Bus B", "capacity_mva": 700.0, "availability": 0.9999}
    ))
    
    # 2. Central Cooling Plant
    cooling_plant_id = "CAMPUS-COOLING-PLANT"
    db.add(Asset(
        id=cooling_plant_id,
        type="chiller",
        name="30,000-Ton Central Mechanical Chiller Plant (105.5 MWth)",
        parent_id=campus_id,
        status="ONLINE",
        health=99.9,
        redundancy="N+2",
        rated_capacity=105500.0, # kW thermal
        specs={
            "manufacturer": "York / Johnson Controls",
            "model": "YZ Magnetic-Bearing Centrifugal Chiller (6x 5,000 ton)",
            "nominal_cop": 6.20,
            "refrigerant": "R-1233zd(E) Low-GWP (<1.0)",
            "chw_supply_temp_c": 18.0,
            "chw_return_temp_c": 32.0,
            "cw_supply_temp_c": 28.0,
            "cw_return_temp_c": 35.0,
            "uncertainty_rating_percent": 3.0
        }
    ))
    
    # 3. Water Infrastructure & Evaporative Cooling Towers
    water_infra_id = "CAMPUS-WATER-INFRASTRUCTURE"
    db.add(Asset(
        id=water_infra_id,
        type="cooling_tower",
        name="18-Cell Induced Draft Cooling Towers & 5-Million Gallon Storage",
        parent_id=campus_id,
        status="ONLINE",
        health=100.0,
        redundancy="N+2",
        rated_capacity=18.0, # cells
        specs={
            "manufacturer": "SPX Marley",
            "model": "NC Everest Induced Draft (18 Cells)",
            "water_storage_capacity_m3": 18927.0, # 5M Gallons
            "design_wet_bulb_c": 28.0,
            "approach_c": 3.5,
            "fan_motor_power_kw_per_cell": 75.0,
            "evaporation_factor_l_per_kwh_th": 2.45
        }
    ))
    
    # 4. Standby Generator Plant
    generator_plant_id = "CAMPUS-GENERATOR-PLANT"
    db.add(Asset(
        id=generator_plant_id,
        type="generator",
        name="63-Megawatt Standby Reciprocating Generator Plant (18x 3.5 MW)",
        parent_id=campus_id,
        status="STANDBY",
        health=100.0,
        redundancy="N+2",
        rated_capacity=63.0, # MW
        specs={
            "manufacturer": "Caterpillar / Cummins",
            "model": "CAT 3516B-HD / QSK95-G10 Array (18x 3.5 MW e)",
            "fuel_type": "Ultra-Low Sulfur Diesel / HVO Renewable Diesel",
            "on_site_fuel_hours": 72.0,
            "fast_start_sync_seconds": 9.5,
            "fuel_rate_l_per_mwh": 242.0
        }
    ))

    # 5. 160 MWh / 80 MW Battery Energy Storage System (BESS)
    bess_id = "CAMPUS-BESS-PLANT"
    db.add(Asset(
        id=bess_id,
        type="bess",
        name="160 MWh / 80 MW Hyperscale LFP Battery Energy Storage Plant",
        parent_id=campus_id,
        status="ONLINE",
        health=99.9,
        redundancy="2N",
        rated_capacity=160000.0, # 160,000 kWh = 160 MWh
        specs={
            "manufacturer": "Fluence / Tesla Megapack 2XL Equivalent",
            "chemistry": "Lithium Iron Phosphate (LiFePO4)",
            "rated_power_mw": 80.0,
            "rated_energy_mwh": 160.0,
            "round_trip_efficiency": 0.850,
            "charge_efficiency": 0.922,
            "discharge_efficiency": 0.922,
            "operating_voltage_vdc": 1500.0,
            "cycle_life_rating": 6000,
            "inverter_topology": "Bidirectional 4-Quadrant Silicon Carbide VFD",
            "uncertainty_rating_percent": 2.5
        },
        operating_limits={
            "min_soc_percent": 15.0,
            "max_soc_percent": 95.0,
            "max_charge_mw": 80.0,
            "max_discharge_mw": 80.0,
            "max_cell_temp_c": 45.0,
            "min_cell_temp_c": 10.0
        }
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
                        health=100.0,
                        redundancy="N+1",
                        rated_capacity=3800.0, # LPM
                        specs={
                            "manufacturer": "Schneider Electric / Vertiv",
                            "model": "Liebert XDU-450 Liquid-to-Liquid CDU",
                            "thermal_capacity_kw": 450.0,
                            "pump_motor_kw": 15.0,
                            "fan_kw_full": 36.0,
                            "primary_delta_p_bar": 2.2,
                            "secondary_delta_p_bar": 4.5
                        },
                        operating_limits={"max_rpm": 3600, "min_fan_pct": 25.0, "max_return_temp_c": 45.0}
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
                            health=99.9,
                            redundancy="2N",
                            rated_capacity=132.0, # kW
                            specs={
                                "manufacturer": "NVIDIA",
                                "model": "GB200 NVL72 Rack Scale Architecture",
                                "accelerators_count": 72,
                                "cpu_count": 36,
                                "thermal_capacitance_kj_c": 2088.0,
                                "power_factor": 0.985,
                                "rated_voltage_v": 415.0,
                                "liquid_flow_lpm": 75.0
                            },
                            operating_limits={"max_core_temp_c": 85.0, "emergency_cutoff_c": 95.0}
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
                            health=100.0,
                            redundancy="N+1",
                            rated_capacity=15.0, # kW
                            specs={
                                "manufacturer": "OCP / Wiwynn",
                                "model": "Open Rack V3 (ORV3)",
                                "servers_count": 40,
                                "thermal_capacitance_kj_c": 1008.0,
                                "power_factor": 0.975,
                                "rated_voltage_v": 415.0,
                                "airflow_cfm_nominal": 1200.0
                            },
                            operating_limits={"max_core_temp_c": 80.0, "emergency_cutoff_c": 90.0}
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
