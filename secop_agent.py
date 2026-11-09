#!/usr/bin/env python3
"""
SECOP II Monitoring Agent
Automated monitoring of SECOP II public procurement for medical/furniture tenders in Atlántico region.
Filters tenders published in the last 30 days and appends them to a Google Sheet.
"""

import requests
import os
import json
from datetime import datetime, timedelta
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# Configuration
SECOPII_API_URL = "https://www.datos.gov.co/resource/jgit-wwrg.json"
REGION_ATLANTICO = "Atlántico"
CATEGORY_MEDICAL = "medical"
CATEGORY_FURNITURE = "furniture"
DAYS_TO_FILTER = 30

# Google Sheets Configuration (from GitHub Secrets)
GCP_SA_KEY = os.getenv("GCP_SA_KEY")
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")

def get_google_sheets_client():
    """Authenticate with Google Sheets using service account key."""
    try:
        print("DEBUG: Attempting to authenticate with Google Sheets...")
        print(f"DEBUG: SPREADSHEET_ID: {SPREADSHEET_ID}")
        print(f"DEBUG: GCP_SA_KEY length: {len(GCP_SA_KEY) if GCP_SA_KEY else 0} characters")
        
        # Decode the base64-encoded key with automatic padding handling
        import base64
        key_dict = None
        
        # Try base64 decoding with automatic padding
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
        except Exception as decode_error:
            print(f"DEBUG: Base64 decoding failed: {decode_error}")
            print(f"DEBUG: Trying to load GCP_SA_KEY as raw JSON string...")
            try:
                key_dict = json.loads(GCP_SA_KEY)
                print(f"DEBUG: Successfully loaded GCP_SA_KEY as raw JSON")
            except Exception as json_error:
                print(f"DEBUG ERROR: Raw JSON loading also failed: {json_error}")
                raise json_error
        
        print(f"DEBUG: Service account email: {key_dict.get('client_email', 'N/A')}")
        
        credentials = ServiceAccountCredentials.from_json_key(key_dict)
        client = gspread.authorize(credentials)
        print("DEBUG: Successfully authenticated with Google Sheets")
        return client
    except Exception as e:
        print(f"DEBUG ERROR: Exception during Google Sheets authentication: {type(e).__name__}: {e}")
        import traceback
        print(f"DEBUG ERROR: Traceback: {traceback.format_exc()}")
        return None

def fetch_tenders():
    """Fetch tenders from SECOP II API."""
    try:
        print(f"DEBUG: API URL: {SECOPII_API_URL}")
        print(f"DEBUG: Requesting tenders from SECOP II API...")
        response = requests.get(SECOPII_API_URL, timeout=30)
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

def filter_recent_tenders(tenders):
    """Filter tenders published in the last 30 days."""
    cutoff_time = datetime.now() - timedelta(days=DAYS_TO_FILTER)
    print(f"DEBUG: Cutoff time for filtering: {cutoff_time}")
    recent_tenders = []
    
    for tender in tenders:
        try:
            # Parse fecha_publicacion (SECOP II date format)
            pub_date_str = tender.get('fecha_publicacion', '')
            if pub_date_str:
                pub_date = datetime.strptime(pub_date_str, '%Y-%m-%dT%H:%M:%S.%f')
                if pub_date >= cutoff_time:
                    recent_tenders.append(tender)
        except Exception as e:
            print(f"DEBUG ERROR: Error parsing date for tender {tender.get('id', 'unknown')}: {e}")
            continue
    
    print(f"DEBUG: After date filtering: {len(recent_tenders)} tenders from the last {DAYS_TO_FILTER} days")
    print(f"Found {len(recent_tenders)} tenders from the last {DAYS_TO_FILTER} days")
    return recent_tenders

def filter_by_region_and_category(tenders):
    """Filter tenders by Atlántico region and medical/furniture categories."""
    print(f"DEBUG: Starting region and category filtering with {len(tenders)} tenders...")
    filtered = []
    
    for tender in tenders:
        entidad = tender.get('nombre_entidad', '').lower()
        departamento = tender.get('departamento', '').lower()
        objeto = tender.get('objeto_contrato', '').lower()
        
        # Filter by Atlántico region
        if REGION_ATLANTICO.lower() not in departamento and REGION_ATLANTICO.lower() not in entidad:
            continue
        
        # Filter by medical/furniture keywords
        medical_keywords = ['mobiliario', 'cama', 'camilla', 'mesa', 'silla', 'hospital', 'clinico', 'consultorio', 'equipamiento', 'mobiliario clínico']
        furniture_keywords = ['mueble', 'silla', 'cama', 'mesa', 'escritorio', 'archivador', 'estantería']
        
        is_medical = any(keyword in objeto for keyword in medical_keywords)
        is_furniture = any(keyword in objeto for keyword in furniture_keywords)
        
        if is_medical or is_furniture:
            tender['category'] = 'medical' if is_medical else 'furniture'
            filtered.append(tender)
    
    print(f"DEBUG: After region/category filtering: {len(filtered)} tenders matching Atlántico region and medical/furniture categories")
    print(f"Found {len(filtered)} tenders matching Atlántico region and medical/furniture categories")
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
    """Append new unique tenders to Google Sheet."""
    try:
        print(f"DEBUG: Opening spreadsheet with ID: {SPREADSHEET_ID}")
        # Open the spreadsheet
        sheet = client.open_by_key(SPREADSHEET_ID)
        print(f"DEBUG: Spreadsheet title: {sheet.title}")
        worksheet = sheet.sheet1
        print(f"DEBUG: Worksheet title: {worksheet.title}")
        
        # Get existing tenders to avoid duplicates
        existing_tender_ids = get_existing_tenders(client, worksheet)
        
        # Add header row if sheet is empty
        if worksheet.row_count == 1:
            print(f"DEBUG: Sheet is empty, adding header row...")
            worksheet.append_row(['ID', 'Objeto', 'Entidad', 'Departamento', 'Fecha Publicación', 'Valor', 'Categoría'])
            print("DEBUG: Added header row to sheet")
        
        # Append new unique tenders
        new_tenders_count = 0
        print(f"DEBUG: Processing {len(tenders)} tenders for appending...")
        for tender in tenders:
            tender_id = tender.get('id', tender.get('contrato_id', ''))
            
            # Skip if already exists
            if tender_id in existing_tender_ids:
                print(f"DEBUG: Skipping duplicate tender ID: {tender_id}")
                continue
            
            # Append tender to sheet
            print(f"DEBUG: Appending tender ID: {tender_id}")
            worksheet.append_row([
                tender_id,
                tender.get('objeto_contrato', 'N/A'),
                tender.get('nombre_entidad', 'N/A'),
                tender.get('departamento', 'N/A'),
                tender.get('fecha_publicacion', 'N/A'),
                tender.get('valor_contrato', 'N/A'),
                tender.get('category', 'N/A')
            ])
            new_tenders_count += 1
            print(f"DEBUG: Successfully added tender: {tender.get('objeto_contrato', 'N/A')}")
        
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
    if not GCP_SA_KEY:
        print("ERROR: GCP_SA_KEY environment variable not set. Please configure in GitHub Secrets.")
        return
    print(f"DEBUG: GCP_SA_KEY is set")
    
    if not SPREADSHEET_ID:
        print("ERROR: SPREADSHEET_ID environment variable not set. Please configure in GitHub Secrets.")
        return
    print(f"DEBUG: SPREADSHEET_ID is set")
    
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
    
    # Filter by region and category
    print(f"DEBUG: Filtering tenders by region (Atlántico) and category (medical/furniture)...")
    filtered_tenders = filter_by_region_and_category(tenders)
    
    # Filter by recent publication (30 days)
    print(f"DEBUG: Filtering tenders by date (last {DAYS_TO_FILTER} days)...")
    recent_tenders = filter_recent_tenders(filtered_tenders)
    
    if not recent_tenders:
        print("No recent tenders found to append to sheet.")
        return
    
    # Append to Google Sheet
    append_tenders_to_sheet(client, recent_tenders)
    
    print("=" * 60)
    print("SECOP II Agent execution completed successfully.")
    print("=" * 60)

if __name__ == "__main__":
    main()

