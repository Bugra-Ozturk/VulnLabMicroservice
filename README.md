# Vulnerable Microservice Hub Demonstration

## Project Overview
This project demonstrates "Hub-Based Vulnerabilities" in a scale-free network architecture within a microservice environment. It is designed for educational and research purposes to illustrate how central components (Hubs) with high degree centrality can become single points of failure and propagate cascading failures throughout a system.

The architecture intentionally lacks standard reliability patterns (rate limiting, circuit breakers, connection pooling) to allow for the clear demonstration of Denial of Service (DoS) and Resource Exhaustion attacks.

## Architecture

The system consists of the following components:

1.  **API Gateway (Primary Hub):** The entry point for all client requests. It has the highest degree centrality (In-Degree: 4, Out-Degree: 3). It routes traffic to downstream services and publishes events to the message broker.
2.  **RabbitMQ (Secondary Hub):** The message broker handling asynchronous communication. It acts as a central node for event distribution.
3.  **Downstream Services:**
    *   **Auth Service:** Handles authentication requests.
    *   **Order Service:** Manages order processing.
    *   **User Service:** Retrieves user profiles.
4.  **Event Processor:** Consumes messages from RabbitMQ (simulating background workers).

## Vulnerabilities Implemented

The following vulnerabilities have been intentionally introduced to model "Fragile Hubs":

| Vulnerability | Component | Description | Impact |
|---------------|-----------|-------------|--------|
| **No Rate Limiting** | API Gateway | Lack of request throttling allows unlimited traffic. | High susceptibility to DoS attacks. |
| **No Connection Pooling** | API Gateway | A new TCP connection to RabbitMQ is opened for every request without closure. | Rapid resource exhaustion (RAM/CPU) and connection limit saturation. |
| **No Circuit Breaker** | API Gateway | Failures in downstream services cause the Gateway to hang. | Cascading failures where one service outage brings down the entire system. |
| **Single Consumer** | Event Processor | Only one consumer process handles all queue events. | Pipeline bottlenecks and queue overflows during high load. |

## Installation and Setup

### Prerequisites
*   Docker and Docker Compose
*   Node.js (for running analysis and attack scripts locally)

### Starting the Environment
To deploy the full microservice stack:

```bash
docker-compose up --build -d
```

This will start all containers: `gateway`, `rabbitmq`, `auth-service`, `order-service`, `user-service`, and `event-processor`.

## Usage and Analysis Tools

The project includes several tools to analyze the architecture and demonstrate vulnerabilities.

### 1. Real-time Monitoring
Displays the health status of all components and tracks resource usage (connections, memory) in real-time.

```bash
cd monitor
node health-check.js
```

### 2. Graph Analysis
Analyzes the architecture as a directed graph to calculate degree centrality, identify hubs, and assess structural risks based on Scale-Free Network theory.

```bash
cd analysis
node graph-analysis.js
```

**Output:**
*   Node Degree Distribution table
*   Identification of Hub components (Gateway, RabbitMQ)
*   Risk Assessment report (DoS risk, Cascading Failure risk)

### 3. Attack Simulations

#### Scenario A: DoS and Resource Exhaustion
Simulates a high-concurrency attack on the API Gateway to demonstrate how the lack of connection pooling and rate limiting leads to system collapse.

```bash
cd attack
node dos-attack.js [concurrency] [duration]
# Example: node dos-attack.js 100 30
```

**Expected Result:**
*   Gateway active connections spike (>1000).
*   RabbitMQ connection limit is reached.
*   Gateway becomes unresponsive.
*   Downstream services become unreachable due to Gateway failure.

#### Scenario B: Cascading Failure
Demonstrates how the failure of a Hub component (RabbitMQ) propagates to dependent services.

```bash
cd attack
node cascade-test.js
```

**Expected Result:**
*   Phase 1: System healthy.
*   Phase 2: RabbitMQ is stopped. API Gateway requests fail even for non-queue related endpoints due to lack of fault isolation.
*   Phase 3: Service restoration.

## Directory Structure

*   **/gateway:** Node.js Express application acting as the API Gateway.
*   **/services:** Contains independent microservices (Auth, Order, User, Event Processor).
*   **/attack:** Scripts for simulating DoS attacks and cascading failures.
*   **/monitor:** Dashboard for visualizing system health metrics.
*   **/analysis:** Graph theory analysis tool for architectural auditing.

## Contact
This project was created for University Security Course Assignment.
