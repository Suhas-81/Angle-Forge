"""AngleForge marketing campaign generation API — synthetic-demo-first."""
from __future__ import annotations
import os
import logging
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.agents import AngleForgeOrchestrator
from app.llm import AIError
from app.sample import SAMPLE
from app.schemas import (BrandAndPersonas, ConceptResponse, GenerateRequest,
                         GenerateResponse, Persona, RecheckRequest, RegenerateRequest)

logger = logging.getLogger(__name__)

app = FastAPI(title='AngleForge AI Marketing Studio', version='2.0.0',
              description='Persona-first marketing, agent pipeline, deterministic rule checks.')
origins = [v.strip() for v in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if v.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])


def demo_mode() -> bool:
    flag = os.getenv('DEMO_MODE', 'auto').lower()
    if flag in ('true', '1', 'yes'): return True
    if flag in ('false', '0', 'no'): return False
    return not os.getenv('GEMINI_API_KEY', '').strip()


def find_persona(personas: list[Persona], persona_id: str):
    return next((p for p in personas if p.id == persona_id), None)


def handle_error(exc: Exception):
    if isinstance(exc, AIError):
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    logger.exception('Unhandled campaign generation failure', exc_info=exc)
    raise HTTPException(status_code=500, detail='Campaign generation failed on the server. Check backend logs for the traceback.') from exc


@app.get('/api/health')
async def health():
    return {'status': 'ok', 'mode': 'demo' if demo_mode() else 'ai',
            'model': 'synthetic-offline-demo' if demo_mode() else os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')}


@app.get('/api/sample')
async def sample():
    return SAMPLE


@app.get('/api/agents')
async def agents():
    return {'architecture': 'orchestrated-task-agents', 'autonomous': False, 'agents': [
        {'name': 'Campaign Strategist', 'responsibility': 'Three different campaign concepts', 'uses_llm': True},
        {'name': 'Persona Copywriter', 'responsibility': 'Distinct social post and email for each persona', 'uses_llm': True},
        {'name': 'Brand Reviewer', 'responsibility': 'Python hard rules + LLM tone score', 'uses_llm': True},
        {'name': 'Content Refinement', 'responsibility': 'One targeted repair, followed by deterministic recheck', 'uses_llm': True},
    ]}


@app.post('/api/concepts', response_model=ConceptResponse)
async def concepts(body: BrandAndPersonas):
    try:
        results, trace = await AngleForgeOrchestrator(demo_mode()).concepts(body.brand, body.personas)
        return {'concepts': results, 'mode': 'demo' if demo_mode() else 'ai', 'trace': trace}
    except AIError as exc: handle_error(exc)


@app.post('/api/generate', response_model=GenerateResponse)
async def generate(body: GenerateRequest):
    try:
        results, trace = await AngleForgeOrchestrator(demo_mode()).generate(body.brand, body.personas, body.concept)
        return {'assets': results, 'mode': 'demo' if demo_mode() else 'ai', 'trace': trace}
    except AIError as exc: handle_error(exc)


@app.post('/api/regenerate')
async def regenerate(body: RegenerateRequest):
    p = find_persona(body.personas, body.persona_id)
    if p is None: raise HTTPException(422, 'Unknown persona_id')
    try:
        checked, trace = await AngleForgeOrchestrator(demo_mode()).regenerate(
            body.brand, p, body.concept, body.asset_type, body.previous, body.revision)
        # Same asset/check response as v1; extra trace is optional UI telemetry.
        return {**checked.model_dump(), 'trace': trace}
    except AIError as exc: handle_error(exc)


@app.post('/api/recheck', response_model=GenerateResponse)
async def recheck(body: RecheckRequest):
    if any(not find_persona(body.personas, a.persona_id) for a in body.assets):
        raise HTTPException(422, 'Unknown persona_id in assets')
    try:
        results, trace = await AngleForgeOrchestrator(demo_mode()).recheck(body.brand, body.personas, body.assets)
        return {'assets': results, 'mode': 'demo' if demo_mode() else 'ai', 'trace': trace}
    except AIError as exc: handle_error(exc)
