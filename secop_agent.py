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
        # Decode the base64-encoded key
        import base64
        key_dict = json.loads(base64.b64decode(GCP_SA_KEY))
        credentials = ServiceAccountCredentials.from_json_key(key_dict)
        client = gspread.authorize(credentials)
        print("Successfully authenticated with Google Sheets")
        return client
    except Exception as e:
        print(f"Error authenticating with Google Sheets: {e}")
        return None

def fetch_tenders():
    """Fetch tenders from SECOP II API."""
    try:
        print(f"Fetching tenders from {SECOPII_API_URL}...")
        response = requests.get(SECOPII_API_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        print(f"Successfully fetched {len(data)} tenders")
        return data
    except Exception as e:
        print(f"Error fetching tenders: {e}")
        return []

def filter_recent_tenders(tenders):
    """Filter tenders published in the last 30 days."""
    cutoff_time = datetime.now() - timedelta(days=DAYS_TO_FILTER)
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
            print(f"Error parsing date for tender {tender.get('id', 'unknown')}: {e}")
            continue
    
    print(f"Found {len(recent_tenders)} tenders from the last {DAYS_TO_FILTER} days")
    return recent_tenders

def filter_by_region_and_category(tenders):
    """Filter tenders by Atlántico region and medical/furniture categories."""
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
    
    print(f"Found {len(filtered)} tenders matching Atlántico region and medical/furniture categories")
    return filtered

def get_existing_tenders(client, worksheet):
    """Get existing tenders from Google Sheet to avoid duplicates."""
    try:
        all_records = worksheet.get_all_values()
        if len(all_records) > 1:
            # Skip header row
            existing_tenders = [row[0] for row in all_records[1:]]
            print(f"Found {len(existing_tenders)} existing tenders in sheet")
            return set(existing_tenders)
        return set()
    except Exception as e:
        print(f"Error reading existing tenders from sheet: {e}")
        return set()

def append_tenders_to_sheet(client, tenders):
    """Append new unique tenders to Google Sheet."""
    try:
        # Open the spreadsheet
        sheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = sheet.sheet1
        
        # Get existing tenders to avoid duplicates
        existing_tender_ids = get_existing_tenders(client, worksheet)
        
        # Add header row if sheet is empty
        if worksheet.row_count == 1:
            worksheet.append_row(['ID', 'Objeto', 'Entidad', 'Departamento', 'Fecha Publicación', 'Valor', 'Categoría'])
            print("Added header row to sheet")
        
        # Append new unique tenders
        new_tenders_count = 0
        for tender in tenders:
            tender_id = tender.get('id', tender.get('contrato_id', ''))
            
            # Skip if already exists
            if tender_id in existing_tender_ids:
                continue
            
            # Append tender to sheet
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
            print(f"Added tender: {tender.get('objeto_contrato', 'N/A')}")
        
        print(f"Successfully appended {new_tenders_count} new tenders to Google Sheet")
        return True
    except Exception as e:
        print(f"Error appending tenders to Google Sheet: {e}")
        return False

def main():
    """Main execution function."""
    print("=" * 60)
    print("SECOP II Monitoring Agent - Domédicos del Norte")
    print("=" * 60)
    
    # Check for required environment variables
    if not GCP_SA_KEY:
        print("ERROR: GCP_SA_KEY environment variable not set. Please configure in GitHub Secrets.")
        return
    
    if not SPREADSHEET_ID:
        print("ERROR: SPREADSHEET_ID environment variable not set. Please configure in GitHub Secrets.")
        return
    
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
    filtered_tenders = filter_by_region_and_category(tenders)
    
    # Filter by recent publication (30 days)
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

