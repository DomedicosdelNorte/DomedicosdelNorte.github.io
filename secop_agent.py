#!/usr/bin/env python3
"""
SECOP II Monitoring Agent - Domédicos del Norte
Automated monitoring of SECOP II public procurement for medical supply/furniture tenders
across the Colombian Caribbean Region (Costa Caribe).
Uses the jbjy-vk9h.json dataset endpoint.
Filters tenders published in the last 30 days using fecha_de_inicio_del_contrato and appends them to a Google Sheet.
"""

import requests
import os
import json
import base64
import unicodedata
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials

# Configuration
SECOPII_API_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"
DAYS_TO_FILTER = 30
API_LIMIT = 1000

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
    'prestacion de servicios profesionales', 'prestación de servicios profesionales',
    'prestacion de servicios de apoyo', 'prestación de servicios de apoyo',
    'apoyo a la gestion', 'apoyo a la gestión',
    'auxiliar de enfermeria', 'auxiliar de enfermería',
    'enfermero', 'enfermera', 'medico general', 'médico general',
    'especialista', 'conductor de ambulancia', 'conductor',
    'aseo', 'vigilancia', 'contador', 'abogado',
    'psicologo', 'psicólogo', 'trabajador social', 'nomina', 'nómina', 'honorarios'
]

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

def fetch_tenders():
    """Fetch tenders from SECOP II API with basic query parameters."""
    try:
        print(f"DEBUG: API URL: {SECOPII_API_URL}")
        print(f"DEBUG: Requesting tenders from SECOP II API...")
        
        # Build query parameters - limit and order only
        params = {
            '$order': 'fecha_de_inicio_del_contrato DESC',
            '$limit': API_LIMIT
        }
        
        print(f"DEBUG: Query parameters: {params}")
        response = requests.get(SECOPII_API_URL, params=params, timeout=30)
        print(f"DEBUG: Response status code: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print(f"DEBUG: Raw count of tenders returned by API: {len(data)}")
        print(f"Successfully fetched {len(data)} tenders")
        return data
    except Exception as e:
        print(f"DEBUG ERROR: Exception during API fetch: {type(e).__name__}: {e}")
        import traceback
        print(f"DEBUG ERROR: Traceback: {traceback.format_exc()}")
        return []

def filter_tenders(tenders):
    """Filter tenders by Caribbean region, priority entities, UNSPSC codes, keywords, and date."""
    cutoff_time = datetime.now() - timedelta(days=DAYS_TO_FILTER)
    print(f"DEBUG: Cutoff time for filtering: {cutoff_time}")
    print(f"DEBUG: Filtering for Caribbean Region (Costa Caribe) departments")
    filtered = []
    
    for tender in tenders:
        try:
            # Filter by Caribbean Region departments (case-insensitive, accent-normalized)
            departamento = normalize_text(tender.get('departamento', ''))
            if not any(dept in departamento for dept in CARIBBEAN_DEPARTMENTS):
                continue
            
            # Filter by date (last 30 days)
            pub_date_str = tender.get('fecha_de_inicio_del_contrato', '')
            if pub_date_str:
                pub_date = datetime.strptime(pub_date_str, '%Y-%m-%dT%H:%M:%S.%f')
                if pub_date < cutoff_time:
                    continue
            
            # Check priority entity NIT matching
            nit_entidad = normalize_nit(tender.get('nit_entidad', ''))
            nombre_entidad = normalize_text(tender.get('nombre_entidad', ''))
            
            # Check if entity matches priority NITs or names
            matches_priority_entity = False
            if nit_entidad in PRIORITY_ENTITIES:
                matches_priority_entity = True
                print(f"DEBUG: Matched priority entity by NIT: {nit_entidad}")
            else:
                # Check entity name matches
                for nit, names in PRIORITY_ENTITIES.items():
                    if any(name in nombre_entidad for name in names):
                        matches_priority_entity = True
                        print(f"DEBUG: Matched priority entity by name: {tender.get('nombre_entidad')}")
                        break
            
            # Check UNSPSC code matching
            unspsc_code = tender.get('codigo_de_categoria_principal', '')
            matches_unspsc = False
            
            if unspsc_code:
                # Remove 'V1.' prefix if present
                unspsc_clean = unspsc_code.replace('V1.', '')
                
                # Check exact code match
                if unspsc_clean in UNSPSC_EXACT_CODES:
                    matches_unspsc = True
                    print(f"DEBUG: Matched exact UNSPSC code: {unspsc_clean}")
                else:
                    # Check family prefix match
                    for prefix in UNSPSC_FAMILY_PREFIXES:
                        if unspsc_clean.startswith(prefix):
                            matches_unspsc = True
                            print(f"DEBUG: Matched UNSPSC family prefix: {unspsc_clean} starts with {prefix}")
                            break
            
            # Check keyword matching (normalized, accent-insensitive)
            objeto_normalized = normalize_text(tender.get('objeto_del_contrato', ''))
            matches_keywords = any(keyword in objeto_normalized for keyword in MEDICAL_KEYWORDS)
            
            # Tender must match: (priority entity OR (UNSPSC OR keywords)) AND Caribbean region
            if not matches_priority_entity and not (matches_unspsc or matches_keywords):
                continue
            
            # Negative filter - exclude HR/staffing/non-supply services
            if any(negative in objeto_normalized for negative in STAFFING_NEGATIVE_FILTERS):
                print(f"DEBUG: Excluding staffing/HR contract: {tender.get('id_contrato', 'unknown')}")
                continue
            
            filtered.append(tender)
        except Exception as e:
            print(f"DEBUG ERROR: Error filtering tender {tender.get('id_contrato', 'unknown')}: {e}")
            continue
    
    print(f"DEBUG: After filtering: {len(filtered)} tenders matching all criteria")
    print(f"Found {len(filtered)} tenders matching Caribbean Region, priority entities, UNSPSC/keywords, last {DAYS_TO_FILTER} days")
    return filtered

def get_existing_tenders(client, worksheet):
    """Get existing tenders from Google Sheet to avoid duplicates."""
    try:
        print(f"DEBUG: Reading existing tenders from Google Sheet...")
        all_records = worksheet.get_all_values()
        print(f"DEBUG: Total rows in sheet: {len(all_records)}")
        if len(all_records) > 1:
            # Skip header row
            existing_tenders = [row[0] for row in all_records[1:]]
            print(f"DEBUG: Found {len(existing_tenders)} existing tenders in sheet")
            return set(existing_tenders)
        print(f"DEBUG: Sheet is empty or only has header row")
        return set()
    except Exception as e:
        print(f"DEBUG ERROR: Exception while reading existing tenders: {type(e).__name__}: {e}")
        import traceback
        print(f"DEBUG ERROR: Traceback: {traceback.format_exc()}")
        return set()

def append_tenders_to_sheet(client, tenders):
    """Append new unique tenders to Google Sheet with correct column mapping."""
    try:
        print(f"DEBUG: Opening spreadsheet with ID: {SPREADSHEET_ID}")
        # Open the spreadsheet
        sheet = client.open_by_key(SPREADSHEET_ID)
        print(f"DEBUG: Spreadsheet title: {sheet.title}")
        worksheet = sheet.sheet1
        print(f"DEBUG: Worksheet title: {worksheet.title}")
        
        # Get existing tenders to avoid duplicates (from Column A - ID Proceso)
        existing_tender_ids = get_existing_tenders(client, worksheet)
        
        # Check if header row exists, if not add it
        header_row = worksheet.row_values(1)
        expected_headers = ["ID Proceso", "Fecha Publicación", "Entidad", "Objeto del Contrato", 
                          "Presupuesto (COP)", "Enlace SECOP II", "Estado Interno", "Asignado A"]
        
        if header_row != expected_headers:
            print(f"DEBUG: Header row does not match expected headers")
            print(f"DEBUG: Current headers: {header_row}")
            print(f"DEBUG: Expected headers: {expected_headers}")
        
        # Append new unique tenders
        new_tenders_count = 0
        print(f"DEBUG: Processing {len(tenders)} tenders for appending...")
        for tender in tenders:
            tender_id = tender.get('id_contrato', '')
            
            # Skip if already exists
            if tender_id in existing_tender_ids:
                print(f"DEBUG: Skipping duplicate tender ID: {tender_id}")
                continue
            
            # Format date (YYYY-MM-DD)
            fecha_pub = tender.get('fecha_de_inicio_del_contrato', tender.get('fecha_de_firma', 'N/A'))
            if fecha_pub and fecha_pub != 'N/A':
                try:
                    fecha_dt = datetime.strptime(fecha_pub, '%Y-%m-%dT%H:%M:%S.%f')
                    fecha_pub = fecha_dt.strftime('%Y-%m-%d')
                except:
                    pass
            
            # Format value as clean number
            valor = tender.get('valor_del_contrato', 'N/A')
            if valor and valor != 'N/A':
                try:
                    valor = str(int(float(valor)))
                except:
                    pass
            
            # Build SECOP II URL
            urlproceso = tender.get('urlproceso', {})
            if isinstance(urlproceso, dict) and 'url' in urlproceso:
                secop_url = urlproceso['url']
            else:
                secop_url = f"https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID={tender_id}"
            
            # Append tender to sheet with correct column mapping
            # Col A: ID Proceso, Col B: Fecha Publicación, Col C: Entidad, Col D: Objeto del Contrato
            # Col E: Presupuesto (COP), Col F: Enlace SECOP II, Col G: Estado Interno, Col H: Asignado A
            print(f"DEBUG: Appending tender ID: {tender_id}")
            worksheet.append_row([
                tender_id,  # Col A: ID Proceso
                fecha_pub,  # Col B: Fecha Publicación
                tender.get('nombre_entidad', 'N/A'),  # Col C: Entidad
                tender.get('objeto_del_contrato', 'N/A'),  # Col D: Objeto del Contrato
                valor,  # Col E: Presupuesto (COP)
                secop_url,  # Col F: Enlace SECOP II
                "Nuevo",  # Col G: Estado Interno
                ""  # Col H: Asignado A
            ])
            new_tenders_count += 1
            print(f"DEBUG: Successfully added tender: {tender.get('objeto_del_contrato', 'N/A')[:50]}...")
        
        print(f"DEBUG: Successfully appended {new_tenders_count} new tenders to Google Sheet")
        print(f"Successfully appended {new_tenders_count} new tenders to Google Sheet")
        return True
    except Exception as e:
        print(f"DEBUG ERROR: Exception during append to Google Sheet: {type(e).__name__}: {e}")
        import traceback
        print(f"DEBUG ERROR: Traceback: {traceback.format_exc()}")
        return False

def main():
    """Main execution function."""
    print("=" * 60)
    print("SECOP II Monitoring Agent - Domédicos del Norte")
    print("Caribbean Region (Costa Caribe) Medical Procurement Monitor")
    print("=" * 60)
    print(f"DEBUG: Starting SECOP II agent execution...")
    print(f"DEBUG: Current time (UTC): {datetime.utcnow()}")
    print(f"DEBUG: Filter window: Last {DAYS_TO_FILTER} days")
    print(f"DEBUG: Target Departments: {', '.join([d.capitalize() for d in CARIBBEAN_DEPARTMENTS[:8]])}")
    print(f"DEBUG: Priority Entities: {len(PRIORITY_ENTITIES)} NITs configured")
    print(f"DEBUG: UNSPSC Codes: {len(UNSPSC_EXACT_CODES)} exact codes, {len(UNSPSC_FAMILY_PREFIXES)} family prefixes")
    
    # Check for required environment variables
    print(f"DEBUG: Checking environment variables...")
    if not SPREADSHEET_ID:
        print("ERROR: SPREADSHEET_ID environment variable not set. Please configure in GitHub Secrets.")
        return
    print(f"DEBUG: SPREADSHEET_ID is set")
    
    # GCP credentials can be from environment variable or gcp_credentials.json file
    print(f"DEBUG: GCP credentials will be loaded from environment variable or gcp_credentials.json file")
    
    # Authenticate with Google Sheets
    client = get_google_sheets_client()
    if not client:
        print("Failed to authenticate with Google Sheets. Exiting.")
        return
    
    # Fetch tenders
    tenders = fetch_tenders()
    
    if not tenders:
        print("No tenders fetched. Exiting.")
        return
    
    # Filter by Caribbean region, priority entities, UNSPSC, keywords, and date
    print(f"DEBUG: Filtering tenders by Caribbean Region, priority entities, UNSPSC/keywords, and date...")
    filtered_tenders = filter_tenders(tenders)
    
    if not filtered_tenders:
        print("No tenders found matching criteria.")
        return
    
    # Append to Google Sheet
    append_tenders_to_sheet(client, filtered_tenders)
    
    print("=" * 60)
    print("SECOP II Agent execution completed successfully.")
    print("=" * 60)

if __name__ == "__main__":
    main()
