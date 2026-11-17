#!/usr/bin/env python3
"""
SECOP II Monitoring Agent - Domédicos del Norte
Automated monitoring of SECOP II public procurement for medical supply/furniture tenders
across the Colombian Caribbean Region (Costa Caribe).
Uses the jbjy-vk9h.json dataset endpoint.
Filters tenders published in the last 60 days using fecha_de_inicio_del_contrato and appends them to a Google Sheet.
"""

import requests
import os
import json
import base64
import unicodedata
from datetime import datetime, timedelta, timezone
import gspread
from google.oauth2.service_account import Credentials

# Configuration
SECOPII_API_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"
DAYS_TO_FILTER = 60  # 2-month window for active opportunities
DAYS_INTELLIGENCE = 365  # 12-month window for intelligence tab
API_LIMIT = 1000
COLOMBIA_TZ = timezone(timedelta(hours=-5))  # America/Bogota (UTC-5)

# Worksheet names
WORKSHEET_OPORTUNIDADES = "Hoja 1"
WORKSHEET_INTELIGENCIA = "Inteligencia de Compras"

# Caribbean Region Departments (Costa Caribe) - with accent variations
CARIBBEAN_DEPARTMENTS = [
    'atlántico', 'atlantico',
    'bolívar', 'bolivar',
    'magdalena',
    'cesar',
    'córdoba', 'cordoba',
    'sucre',
    'la guajira', 'guajira'
]

# High-Priority Entity NITs and Names (normalized NIT digits)
PRIORITY_ENTITIES = {
    '890102006': ['gobernacion del atlantico', 'secretaria de salud departamental del atlantico'],
    '890102018': ['alcaldia distrital de barranquilla', 'secretaria distrital de salud de barranquilla'],
    '890480059': ['gobernacion de bolivar', 'secretaria de salud de bolivar'],
    '890480184': ['dadis', 'departamento administrativo distrital de salud de cartagena'],
    '800103920': ['gobernacion del magdalena', 'secretaria seccional de salud del magdalena'],
    '892399999': ['gobernacion del cesar'],
    '800098911': ['alcaldia de valledupar'],
    '800103935': ['gobernacion de cordoba'],
    '800096734': ['alcaldia de monteria'],
    '892280021': ['gobernacion de sucre'],
    '800104062': ['alcaldia de sincelejo'],
    '892115015': ['gobernacion de la guajira'],
    '892115007': ['alcaldia de riohacha']
}

# UNSPSC Codes - Families 42 & 43 (Medical Equipment & Supplies)
UNSPSC_EXACT_CODES = [
    # Textiles & Medical Apparel
    '42131500', '42131600', '42131700', '42132100', '42132200',
    # Patient Care, Supplies & Treatment
    '42141500', '42141501', '42141502', '42141503', '42141504',
    '42141600', '42141601', '42141602', '42141603', '42141605', '42141606', '42141607', '42141608',
    '42141700', '42141701', '42141702', '42141703', '42141705',
    '42141800', '42141801', '42141802', '42141803', '42141804', '42141805', '42141806', '42141807', '42141808', '42141809', '42141810', '42141811', '42141812', '42141813', '42141814', '42141815', '42141816',
    '42141900', '42141901', '42141902', '42141903', '42141904', '42141905',
    '42142000', '42142001', '42142002', '42142003', '42142004', '42142005', '42142006', '42142007',
    '42142100', '42142101', '42142102', '42142103', '42142104', '42142105', '42142106', '42142107', '42142108', '42142109', '42142110', '42142111', '42142112', '42142113', '42142114', '42142119', '42142120', '42142121',
    '42142200', '42142300', '42142400', '42142500', '42142501', '42142502', '42142503', '42142504', '42142505', '42142506', '42142507', '42142509', '42142510', '42142511', '42142512', '42142513', '42142514', '42142515', '42142516', '42142517', '42142518', '42142538',
    '42142600', '42142700', '42142800', '42142900',
    '42143100', '42143200', '42143300', '42143400', '42143500', '42143600', '42143700', '42143800', '42143900',
    '42144000', '42144100', '42144200', '42144300',
    # Dental Equipment & Supplies
    '42151500', '42151600', '42151700', '42151800', '42151900', '42152000', '42152100', '42152200', '42152300', '42152400', '42152500', '42152600', '42152700', '42152800',
    # Emergency, Dialysis, Diagnostic, Rehab, Sterilization & Surgical
    '42170000', '42180000', '42191900', '42200000', '42210000', '42220000', '42230000', '42240000', '42250000', '42260000', '42270000', '42280000', '42290000', '42300000', '42310000', '42320000'
]

# UNSPSC Family Prefixes (to match any code starting with these)
UNSPSC_FAMILY_PREFIXES = [
    '4213', '4214', '4215', '4217', '4218', '4219',
    '4220', '4221', '4222', '4223', '4224', '4225', '4226', '4227', '4228', '4229', '4230', '4231', '4232'
]

# Medical Supply & Furniture Keywords (case-insensitive, accent-normalized)
MEDICAL_KEYWORDS = [
    'suministros medicos', 'suministros médicos',
    'equipos medicos', 'equipos médicos',
    'insumos medicos', 'insumos médicos',
    'material medico', 'material médico',
    'dispositivos medicos', 'dispositivos médicos',
    'equipo biomedico', 'equipo biomédico',
    'mobiliario', 'cama hospitalaria', 'camilla', 'dotacion hospitalaria', 'dotación hospitalaria',
    'quirurgico', 'quirúrgico', 'instrumental', 'silla de ruedas',
    'consultorio', 'clinico', 'clínico', 'equipamiento',
    'esterilizacion', 'esterilización', 'odontologico', 'odontológico', 'rehabilitacion', 'rehabilitación'
]

# Negative Filter - HR/Staffing/Non-Supply Services (case-insensitive, accent-normalized)
STAFFING_NEGATIVE_FILTERS = [
    # Service/staffing phrasing
    'prestacion de servicios', 'prestación de servicios',
    'prestar servicios', 'prestar los servicios',
    'servicios profesionales', 'servicios tecnicos',
    'servicios de apoyo', 'apoyo tecnico', 'apoyo técnico',
    'apoyo a la gestion', 'apoyo a la gestión',
    'acompanamiento', 'acompañamiento',
    'interventoria', 'interventoría',
    'consultoria', 'consultoría',
    'asesoria', 'asesoría',
    'honorarios', 'nomina', 'nómina',
    # Non-supply roles & operations
    'auxiliar de enfermeria', 'auxiliar de enfermería',
    'enfermero', 'enfermera', 'medico general', 'médico general',
    'especialista', 'conductor', 'conductor de ambulancia',
    'aseo', 'vigilancia', 'contador', 'abogado',
    'psicologo', 'psicólogo', 'trabajador social',
    'operador de maquinaria',
    # Non-medical services
    'divulgacion', 'divulgación', 'radial', 'pauta',
    'alimentacion', 'alimentación', 'refrigerio', 'refrigerio',
    'almuerzo',
    # Maintenance & works
    'mantenimiento preventivo', 'mantenimiento correctivo',
    'mantenimiento', 'obra', 'mejoramiento de la via', 'mejoramiento de la vía',
    'vulnerabilidad sismica', 'vulnerabilidad sísmica',
    'comodato', 'residuos'
]

# Procurement Modalities (case-insensitive, accent-normalized)
PROCUREMENT_MODALITIES = [
    'licitacion publica', 'licitación pública',
    'licitacion publica obra', 'licitación pública obra',
    'licitacion publica suministro', 'licitación pública suministro',
    'subasta inversa', 'seleccion abreviada subasta inversa',
    'seleccion abreviada de menor cantidad',
    'minima cantidad', 'mínima cantidad',
    'contratacion directa', 'contratación directa',
    'regimen especial', 'régimen especial',
    'regimen especial con ofertas', 'régimen especial con ofertas'
]

# Contract States for classification
CONTRACT_STATES_AWARDED = ['adjudicado', 'celebrado', 'firmado']
CONTRACT_STATES_ACTIVE = ['borrador', 'planeacion', 'publicado', 'abierto', 'en proceso']

# Google Sheets Configuration (from GitHub Secrets)
GCP_SA_KEY = os.getenv("GCP_SA_KEY")
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
GCP_CREDENTIALS_FILE = "gcp_credentials.json"

# Google API Scopes
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

def normalize_text(text):
    """Normalize text by removing accents and converting to lowercase."""
    if not text:
        return ''
    # Remove accents
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('ASCII')
    return text.lower()

def normalize_nit(nit):
    """Normalize NIT by removing hyphens and check digits."""
    if not nit:
        return ''
    # Remove all non-digit characters
    return ''.join(c for c in str(nit) if c.isdigit())

def load_gcp_credentials():
    """
    Load GCP service account credentials from environment variable or JSON file.
    Tries raw JSON first, then base64-decoded JSON, then falls back to file.
    """
    print("DEBUG: Loading GCP credentials...")
    
    # Try environment variable as raw JSON first
    if GCP_SA_KEY:
        print(f"DEBUG: GCP_SA_KEY found, length: {len(GCP_SA_KEY)} characters")
        try:
            key_dict = json.loads(GCP_SA_KEY)
            print(f"DEBUG: Successfully loaded GCP_SA_KEY as raw JSON")
            return key_dict
        except (json.JSONDecodeError, ValueError) as e:
            print(f"DEBUG: Failed to parse GCP_SA_KEY as raw JSON: {e}")
            print(f"DEBUG: Trying base64 decoding...")
            try:
                # Add padding if needed (base64 requires length to be multiple of 4)
                padded_key = GCP_SA_KEY
                if len(GCP_SA_KEY) % 4 != 0:
                    padding_needed = 4 - (len(GCP_SA_KEY) % 4)
                    padded_key = GCP_SA_KEY + ('=' * padding_needed)
                    print(f"DEBUG: Added {padding_needed} padding characters to GCP_SA_KEY")
                
                decoded_key = base64.b64decode(padded_key)
                key_dict = json.loads(decoded_key)
                print(f"DEBUG: Successfully decoded GCP_SA_KEY using base64")
                return key_dict
            except Exception as decode_error:
                print(f"DEBUG: Base64 decoding also failed: {decode_error}")
    
    # Fallback to JSON file
    if os.path.exists(GCP_CREDENTIALS_FILE):
        print(f"DEBUG: Loading credentials from file: {GCP_CREDENTIALS_FILE}")
        try:
            with open(GCP_CREDENTIALS_FILE, 'r') as f:
                key_dict = json.load(f)
            print(f"DEBUG: Successfully loaded credentials from JSON file")
            return key_dict
        except Exception as e:
            print(f"DEBUG ERROR: Failed to load credentials from file: {e}")
    
    raise ValueError("No valid GCP credentials found in environment variable or gcp_credentials.json file")

def get_google_sheets_client():
    """Authenticate with Google Sheets using service account key."""
    try:
        print("DEBUG: Attempting to authenticate with Google Sheets...")
        print(f"DEBUG: SPREADSHEET_ID: {SPREADSHEET_ID}")
        
        # Load credentials from environment variable or JSON file
        key_dict = load_gcp_credentials()
        
        print(f"DEBUG: Service account email: {key_dict.get('client_email', 'N/A')}")
        
        # Initialize credentials using modern google-auth library
        creds = Credentials.from_service_account_info(key_dict, scopes=SCOPES)
        client = gspread.authorize(creds)
        print("DEBUG: Successfully authenticated with Google Sheets")
        return client
    except Exception as e:
        print(f"DEBUG ERROR: Exception during Google Sheets authentication: {type(e).__name__}: {e}")
        import traceback
        print(f"DEBUG ERROR: Traceback: {traceback.format_exc()}")
        return None

def parse_tender_date(tender):
    """Parse and validate tender date from multiple fields."""
    # Try fecha_de_inicio_del_contrato first
    date_str = tender.get('fecha_de_inicio_del_contrato', '')
    if date_str and date_str not in ['N/A', '', None]:
        try:
            return datetime.strptime(date_str, '%Y-%m-%dT%H:%M:%S.%f')
        except:
            pass
    
    # Try fecha_de_firma
    date_str = tender.get('fecha_de_firma', '')
    if date_str and date_str not in ['N/A', '', None]:
        try:
            return datetime.strptime(date_str, '%Y-%m-%dT%H:%M:%S.%f')
        except:
            pass
    
    # Try fecha_publicacion
    date_str = tender.get('fecha_publicacion', '')
    if date_str and date_str not in ['N/A', '', None]:
        try:
            return datetime.strptime(date_str, '%Y-%m-%dT%H:%M:%S.%f')
        except:
            pass
    
    return None

def fetch_tenders(days_offset=DAYS_TO_FILTER):
    """Fetch tenders from SECOP II API with date filter in query parameters."""
    try:
        print(f"DEBUG: API URL: {SECOPII_API_URL}")
        print(f"DEBUG: Requesting tenders from SECOP II API...")
        
        # Calculate date cutoff for specified days in Colombia timezone
        colombia_now = datetime.now(COLOMBIA_TZ)
        cutoff_date = (colombia_now - timedelta(days=days_offset)).strftime('%Y-%m-%d')
        today_date = colombia_now.strftime('%Y-%m-%d')
        
        print(f"DEBUG: Colombia current date: {today_date}")
        print(f"DEBUG: Date filter: >= {cutoff_date} and <= {today_date} (window: {days_offset} days)")
        
        # Build query parameters with date filter
        params = {
            '$where': f"fecha_de_inicio_del_contrato >= '{cutoff_date}' AND fecha_de_inicio_del_contrato <= '{today_date}'",
            '$order': 'fecha_de_inicio_del_contrato DESC',
            '$limit': API_LIMIT
        }
        
        print(f"DEBUG: Query parameters: {params}")
        response = requests.get(SECOPII_API_URL, params=params, timeout=30)
        print(f"DEBUG: Response status code: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        
        # Validate data structure
        if not isinstance(data, list):
            print(f"DEBUG WARNING: API returned non-list data type: {type(data)}")
            return []
        
        if not data:
            print(f"DEBUG: API returned empty list (no tenders found for this period)")
            return []
        
        print(f"DEBUG: Raw count of tenders returned by API: {len(data)}")
        print(f"Successfully fetched {len(data)} tenders")
        return data
    except requests.exceptions.Timeout:
        print(f"DEBUG WARNING: API request timed out after 30 seconds")
        return []
    except requests.exceptions.RequestException as e:
        print(f"DEBUG WARNING: API request failed: {type(e).__name__}: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"DEBUG WARNING: Failed to parse JSON response: {e}")
        return []
    except Exception as e:
        print(f"DEBUG ERROR: Unexpected exception during API fetch: {type(e).__name__}: {e}")
        import traceback
        print(f"DEBUG ERROR: Traceback: {traceback.format_exc()}")
        return []

def filter_tenders(tenders):
    """Filter tenders by Caribbean region, UNSPSC codes, keywords, and date (all modalities)."""
    # Validate input data structure
    if not tenders:
        print("DEBUG: No tenders provided to filter")
        return []
    
    if not isinstance(tenders, list):
        print(f"DEBUG WARNING: Expected list of tenders, got {type(tenders)}")
        return []
    
    colombia_now = datetime.now(COLOMBIA_TZ)
    cutoff_time = colombia_now - timedelta(days=DAYS_TO_FILTER)
    print(f"DEBUG: Cutoff time for filtering: {cutoff_time} (Colombia Time)")
    print(f"DEBUG: Filtering for Caribbean Region (Costa Caribe) departments - ALL MODALITIES")
    filtered = []
    
    for tender in tenders:
        try:
            # Validate tender structure
            if not isinstance(tender, dict):
                print(f"DEBUG WARNING: Tender is not a dictionary, skipping")
                continue
            
            # Parse and validate date - discard if missing or invalid
            tender_date = parse_tender_date(tender)
            if not tender_date:
                print(f"DEBUG: Discarding tender with missing/invalid date: {tender.get('id_contrato', 'unknown')}")
                continue
            
            # Filter by date (within last 60 days)
            if tender_date < cutoff_time or tender_date > colombia_now:
                print(f"DEBUG: Discarding tender outside 60-day window: {tender.get('id_contrato', 'unknown')} date: {tender_date}")
                continue
            
            # Filter by Caribbean Region departments (case-insensitive, accent-normalized)
            departamento = normalize_text(tender.get('departamento', ''))
            if not any(dept in departamento for dept in CARIBBEAN_DEPARTMENTS):
                continue
            
            # Check priority entity NIT matching (for logging/boost, not bypass)
            nit_entidad = normalize_nit(tender.get('nit_entidad', ''))
            nombre_entidad = normalize_text(tender.get('nombre_entidad', ''))
            
            matches_priority_entity = False
            if nit_entidad in PRIORITY_ENTITIES:
                matches_priority_entity = True
                print(f"DEBUG: Matched priority entity by NIT: {nit_entidad}")
            else:
                for nit, names in PRIORITY_ENTITIES.items():
                    if any(name in nombre_entidad for name in names):
                        matches_priority_entity = True
                        print(f"DEBUG: Matched priority entity by name: {tender.get('nombre_entidad')}")
                        break
            
            # Check UNSPSC code matching
            unspsc_code = tender.get('codigo_de_categoria_principal', '')
            matches_unspsc = False
            
            if unspsc_code:
                unspsc_clean = str(unspsc_code).replace('V1.', '')
                if unspsc_clean in UNSPSC_EXACT_CODES:
                    matches_unspsc = True
                    print(f"DEBUG: Matched exact UNSPSC code: {unspsc_clean}")
                else:
                    for prefix in UNSPSC_FAMILY_PREFIXES:
                        if unspsc_clean.startswith(prefix):
                            matches_unspsc = True
                            print(f"DEBUG: Matched UNSPSC family prefix: {unspsc_clean} starts with {prefix}")
                            break
            
            # Check keyword matching (normalized, accent-insensitive)
            objeto_normalized = normalize_text(tender.get('objeto_del_contrato', ''))
            matches_keywords = any(keyword in objeto_normalized for keyword in MEDICAL_KEYWORDS)
            
            # FIXED BOOLEAN PRECEDENCE: Must match (UNSPSC OR keywords) AND Caribbean region
            # Priority entity is just a boost, never bypasses medical requirement
            # NO MODALITY RESTRICTION - capture all procurement modalities
            if not (matches_unspsc or matches_keywords):
                print(f"DEBUG: Discarding tender - no UNSPSC/keyword match: {tender.get('id_contrato', 'unknown')}")
                continue
            
            # Negative filter - exclude HR/staffing/non-supply services
            if any(negative in objeto_normalized for negative in STAFFING_NEGATIVE_FILTERS):
                print(f"DEBUG: Excluding staffing/HR/non-supply contract: {tender.get('id_contrato', 'unknown')}")
                continue
            
            # Extract modalidad and estado with safe fallbacks
            modalidad = tender.get('modalidad_de_contratacion', 'N/A') or 'N/A'
            estado_raw = tender.get('estado_contrato', '') or ''
            estado = normalize_text(estado_raw)
            
            # Add parsed date and additional fields to tender
            tender['parsed_date'] = tender_date
            tender['formatted_date'] = tender_date.strftime('%Y-%m-%d')
            tender['modalidad'] = modalidad
            tender['estado'] = tender.get('estado_contrato', 'N/A') or 'N/A'
            tender['estado_normalized'] = estado
            
            filtered.append(tender)
        except Exception as e:
            tender_id = tender.get('id_contrato', 'unknown') if isinstance(tender, dict) else 'unknown'
            print(f"DEBUG ERROR: Error filtering tender {tender_id}: {type(e).__name__}: {e}")
            continue
    
    print(f"DEBUG: After filtering: {len(filtered)} tenders matching all criteria")
    print(f"Found {len(filtered)} tenders matching Caribbean Region, UNSPSC/keywords, last {DAYS_TO_FILTER} days (ALL MODALITIES)")
    return filtered

def filter_intelligence_tenders(tenders):
    """Filter awarded/closed contracts for intelligence tab (last 12 months)."""
    # Validate input data structure
    if not tenders:
        print("DEBUG: No tenders provided for intelligence filtering")
        return []
    
    if not isinstance(tenders, list):
        print(f"DEBUG WARNING: Expected list of tenders, got {type(tenders)}")
        return []
    
    colombia_now = datetime.now(COLOMBIA_TZ)
    cutoff_time = colombia_now - timedelta(days=DAYS_INTELLIGENCE)
    print(f"DEBUG: Intelligence cutoff time: {cutoff_time} (Colombia Time) - Last 12 months")
    print(f"DEBUG: Filtering for awarded/closed contracts across Caribbean Region")
    filtered = []
    
    for tender in tenders:
        try:
            # Validate tender structure
            if not isinstance(tender, dict):
                print(f"DEBUG WARNING: Tender is not a dictionary, skipping")
                continue
            
            # Parse and validate date
            tender_date = parse_tender_date(tender)
            if not tender_date:
                continue
            
            # Filter by date (within last 12 months)
            if tender_date < cutoff_time or tender_date > colombia_now:
                continue
            
            # Filter by Caribbean Region departments
            departamento = normalize_text(tender.get('departamento', ''))
            if not any(dept in departamento for dept in CARIBBEAN_DEPARTMENTS):
                continue
            
            # Check if contract is awarded/closed
            estado_raw = tender.get('estado_contrato', '') or ''
            estado_normalized = normalize_text(estado_raw)
            is_awarded = any(state in estado_normalized for state in CONTRACT_STATES_AWARDED)
            
            if not is_awarded:
                continue
            
            # Apply strict medical filter (UNSPSC OR keywords)
            unspsc_code = tender.get('codigo_de_categoria_principal', '')
            matches_unspsc = False
            
            if unspsc_code:
                unspsc_clean = str(unspsc_code).replace('V1.', '')
                if unspsc_clean in UNSPSC_EXACT_CODES:
                    matches_unspsc = True
                else:
                    for prefix in UNSPSC_FAMILY_PREFIXES:
                        if unspsc_clean.startswith(prefix):
                            matches_unspsc = True
                            break
            
            objeto_normalized = normalize_text(tender.get('objeto_del_contrato', ''))
            matches_keywords = any(keyword in objeto_normalized for keyword in MEDICAL_KEYWORDS)
            
            if not (matches_unspsc or matches_keywords):
                continue
            
            # Negative filter - exclude HR/staffing/non-supply services
            if any(negative in objeto_normalized for negative in STAFFING_NEGATIVE_FILTERS):
                continue
            
            # Add parsed date and fields with safe fallbacks
            tender['parsed_date'] = tender_date
            tender['formatted_date'] = tender_date.strftime('%Y-%m-%d')
            tender['modalidad'] = tender.get('modalidad_de_contratacion', 'N/A') or 'N/A'
            tender['estado'] = tender.get('estado_contrato', 'N/A') or 'N/A'
            tender['estado_normalized'] = estado_normalized
            
            filtered.append(tender)
        except Exception as e:
            tender_id = tender.get('id_contrato', 'unknown') if isinstance(tender, dict) else 'unknown'
            print(f"DEBUG ERROR: Error filtering intelligence tender {tender_id}: {type(e).__name__}: {e}")
            continue
    
    print(f"DEBUG: After intelligence filtering: {len(filtered)} awarded contracts found")
    return filtered
