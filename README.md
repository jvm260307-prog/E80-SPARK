# ⚡ E80 SPARK 

# Dual Spectrum Wireless Power Link

### A hybrid laser–microwave approach to adaptive wireless power transmission

---

## 🌍 Project Overview

EAT Spark explores a hybrid wireless power transmission system that combines laser and microwave technologies to deliver energy over long distances.

The concept aims to adapt transmission methods to atmospheric conditions, making wireless power delivery more resilient for applications such as drone charging, remote infrastructure, and disaster-prone regions.

The project includes a laser transmission simulation to study how distance, weather, beam divergence, and receiver efficiency affect delivered power.

---

## 🛰️ System Architecture

The following diagram illustrates the proposed hybrid system.

flowchart TD
    A["⚡ Power Source"] --> B["Transmission System"]

    B --> C["Laser Transmitter"]
    B --> D["Microwave Transmitter"]

    C --> E["Optical Beam"]
    D --> F["Microwave Beam"]

    E --> G["Atmospheric Conditions"]
    F --> G

    G --> H{"Weather and Link Assessment"}

    H -->|"Optical link suitable"| I["Laser Transmission"]
    H -->|"Optical link degraded"| J["Microwave Transmission"]

    I --> K["Remote Receiver"]
    J --> K

    K --> L["Power Conversion"]
    L --> M["⚙️ Usable Electrical Power"]

   

Note: The weather-dependent laser/microwave selection represents the proposed hybrid architecture. The current simulation focuses on modelling the laser transmission link.

---

## 🔬 Laser Simulation Workflow

The simulation studies how much optical power reaches a receiver after accounting for transmission losses.

flowchart TD
    A["Set Simulation Parameters"] --> B["Laser Input Power"]
    B --> C["Calculate Beam Diameter at 2 km"]
    C --> D["Evaluate Receiver Overlap"]
    D --> E["Apply Pointing Error"]
    E --> F["Calculate Atmospheric Attenuation"]

    F --> G["Estimate Optical Power at Receiver"]
    G --> H["Apply Photovoltaic Conversion Efficiency"]
    H --> I["Calculate DC Output Power"]

    I --> J["Compare Weather Scenarios"]
    J --> K["Analyze Transmission Efficiency"]

    style A fill:#e0f2fe,stroke:#0284c7,color:#111
    style F fill:#fef3c7,stroke:#d97706,color:#111
    style I fill:#d1fae5,stroke:#059669,color:#111

## Parameters investigated

Parameter| Description
Wavelength| 1550 nm laser
Transmission distance| 2 km
Input power| 100 W baseline
Beam divergence| Controls beam spreading
Pointing error| Models transmitter alignment error
Receiver aperture| Determines captured optical power
Atmospheric attenuation| Represents weather-related losses
PV efficiency| Converts received optical power into DC electricity

The exact values used in the simulation should be documented alongside the code, particularly if the final baseline differs from these example parameters.

---

## 🌦️ Weather Scenarios

The simulation can compare the laser link under different atmospheric conditions.

flowchart LR
    A["🌤️ Clear"] --> E["Atmospheric Loss Model"]
    B["🌫️ Haze"] --> E
    C["🌧️ Rain"] --> E
    D["🌁 Fog"] --> E

    E --> F["Received Optical Power"]
    F --> G["DC Power Output"]
    G --> H["Compare Link Performance"]

Weather affects the amount of optical energy that reaches the receiver. Comparing scenarios helps identify conditions under which laser transmission may become less effective and a microwave alternative could be investigated.

---

## 📊 What the Simulation Evaluates

- Optical power captured by the receiver.
- Transmission losses due to beam spreading and pointing errors.
- Atmospheric attenuation under different weather conditions.
- Electrical power produced after photovoltaic conversion.
- Changes in link performance across environmental scenarios.

These results provide a starting point for evaluating the feasibility of the proposed dual-spectrum system.

---

## 🎯 Potential Applications

- Drone charging: Wireless energy delivery to aerial platforms.
- Remote power delivery: Supplying energy to locations with limited infrastructure.
- Disaster response: Exploring power transmission when conventional power networks are disrupted.
- Adaptive wireless energy systems: Investigating how different transmission bands can complement each other.

---

## 🚀 Future Development

- Develop a microwave transmission model and compare its performance with the laser link.
- Implement a weather-aware switching algorithm.
- Explore dynamic transmitter tracking and receiver alignment.
- Add optical and microwave safety constraints.
- Validate simulation results through experimental hardware.

---

## ⚠️ Safety and Limitations

This project is a simulation-based engineering exploration, not a validated operational power system. High-power laser transmission can cause serious eye and skin injuries, and microwave transmission requires appropriate exposure controls. Any physical implementation would require engineered safety systems, regulatory compliance, and experimental validation.

---

## 📌 Project Status

Laser transmission simulation: Developed
Hybrid laser–microwave switching: Proposed; further modelling required
Hardware validation: Future work
