#!/usr/bin/env python3
"""
SECOP II Monitoring Agent
Automated monitoring of SECOP II public procurement for medical/furniture tenders in Atlántico region.
Uses the jbjy-vk9h.json dataset endpoint with Socrata API query parameters.
Filters tenders published in the last 30 days using fecha_de_inicio_del_contrato and appends them to a Google Sheet.
"""

import requests
import os
import json
import base64
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials

# Configuration
SECOPII_API_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"
REGION_ATLANTICO = "Atlántico"
CATEGORY_MEDICAL = "medical"
CATEGORY_FURNITURE = "furniture"
DAYS_TO_FILTER = 30
API_LIMIT = 1000

# Google Sheets Configuration (from GitHub Secrets)
GCP_SA_KEY = os.getenv("GCP_SA_KEY")
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
GCP_CREDENTIALS_FILE = "gcp_credentials.json"

# Google API Scopes
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

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
    """Filter tenders by region, date, and keywords in Python."""
    cutoff_time = datetime.now() - timedelta(days=DAYS_TO_FILTER)
    print(f"DEBUG: Cutoff time for filtering: {cutoff_time}")
    filtered = []
    
    # Staffing phrases to exclude
    staffing_phrases = [
        'prestacion de servicios profesionales',
        'prestación de servicios profesionales',
        'prestacion de servicios de apoyo',
        'prestación de servicios de apoyo',
        'auxiliar de enfermeria',
        'auxiliar de enfermería',
        'conductor de ambulancia'
    ]
    
    # Medical supply and clinical furniture keywords (excluding generic terms like "hospital")
    keywords = [
        'mobiliario', 'cama hospitalaria', 'camilla', 'insumos medicos', 'insumos médicos',
        'dispositivos medicos', 'dispositivos médicos', 'equipo biomedico', 'equipo biomédico',
        'equipos medicos', 'equipos médicos', 'dotacion hospitalaria', 'dotación hospitalaria',
        'material medico', 'material médico', 'quirurgico', 'quirúrgico', 'instrumental',
        'silla de ruedas', 'consultorio', 'clinico', 'clínico', 'equipamiento'
    ]
    
    for tender in tenders:
        try:
            # Filter by department (Atlántico)
            departamento = tender.get('departamento', '').lower()
            if REGION_ATLANTICO.lower() not in departamento:
                continue
            
            # Filter by date (last 30 days)
            pub_date_str = tender.get('fecha_de_inicio_del_contrato', '')
            if pub_date_str:
                pub_date = datetime.strptime(pub_date_str, '%Y-%m-%dT%H:%M:%S.%f')
                if pub_date < cutoff_time:
                    continue
            
            # Filter by keywords - medical supply and clinical furniture only
            objeto = tender.get('objeto_del_contrato', '').lower()
            if not any(keyword in objeto for keyword in keywords):
                continue
            
            # Exclude staffing/professional services contracts
            if any(phrase in objeto for phrase in staffing_phrases):
                print(f"DEBUG: Excluding staffing contract: {tender.get('id_contrato', 'unknown')}")
                continue
            
            filtered.append(tender)
        except Exception as e:
            print(f"DEBUG ERROR: Error filtering tender {tender.get('id_contrato', 'unknown')}: {e}")
            continue
    
    print(f"DEBUG: After filtering: {len(filtered)} tenders matching all criteria")
    print(f"Found {len(filtered)} tenders matching Atlántico region, last {DAYS_TO_FILTER} days, and medical supply/furniture keywords")
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
    print("=" * 60)
    print(f"DEBUG: Starting SECOP II agent execution...")
    print(f"DEBUG: Current time (UTC): {datetime.utcnow()}")
    print(f"DEBUG: Filter window: Last {DAYS_TO_FILTER} days")
    
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
    
    # Filter by region, date, and keywords
    print(f"DEBUG: Filtering tenders by region (Atlántico), date (last {DAYS_TO_FILTER} days), and keywords...")
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
