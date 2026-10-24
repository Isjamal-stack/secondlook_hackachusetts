# SecondLook Startup Instructions

## Prerequisites
- Python 3.9+ installed
- pip3 available

## Quick Start

### 1. Start Explanation Service (Person B)
```bash
cd server
pip3 install -r requirements.txt
python3 server.py
```

Server runs on: **http://localhost:3000**

Endpoints:
- `POST /api/explain` - Generate explanation for diagnostic event
- `GET /api/health` - Check service status

### 2. Start Frontend (Person C)
```bash
# In project root
python3 -m http.server 8000
```

Frontend runs on: **http://localhost:8000**

### 3. Test Explanation Service
```bash
curl -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "test-1",
    "condition": "sustained_temperature_rise",
    "urgency": "attention",
    "approved_next_step": "Stop driving and check coolant level."
  }'
```

Expected response:
```json
{
  "event_id": "test-1",
  "title": "Coolant temperature is continuing to rise",
  "explanation": "Your engine coolant temperature has been rising steadily...",
  "next_step": "Stop driving and check coolant level.",
  "explanation_source": "template"
}
```

## Service Status
- ✅ Explanation Service: Running in template mode
- ⏳ AI Integration: Next phase (minutes 20-60)
- ⏳ Frontend Integration: Person C responsibility
- ⏳ Simulation: Person A responsibility

## Environment Configuration (Optional)

For AI model integration (minutes 20-60):
```bash
cd server
cp .env.example .env
# Edit .env with your AI credentials
```

## Verified Features
- ✅ Template explanations for all conditions
- ✅ Request validation
- ✅ Response validation
- ✅ Event ID caching
- ✅ Error handling and fallback
- ✅ Health check endpoint

---
Last verified: 2026-10-24 15:54 UTC
Person B deliverable complete (minutes 15-20)
