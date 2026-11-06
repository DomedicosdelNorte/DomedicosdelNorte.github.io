#!/usr/bin/env python3
"""
SECOP II Monitoring Agent
Automated monitoring of SECOP II public procurement for medical/furniture tenders in Atlántico region.
Filters tenders published in the last 48 hours and sends HTML report via SMTP email.
"""

import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import os
import json

# Configuration
SECOPII_API_URL = "https://www.datos.gov.co/resource/jgit-wwrg.json"
REGION_ATLANTICO = "Atlántico"
CATEGORY_MEDICAL = "medical"
CATEGORY_FURNITURE = "furniture"
HOURS_TO_FILTER = 48

# SMTP Configuration (from GitHub Secrets)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
RECEIVER_EMAIL = os.getenv("RECEIVER_EMAIL")

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
    """Filter tenders published in the last 48 hours."""
    cutoff_time = datetime.now() - timedelta(hours=HOURS_TO_FILTER)
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
    
    print(f"Found {len(recent_tenders)} tenders from the last {HOURS_TO_FILTER} hours")
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

def generate_html_report(tenders):
    """Generate HTML report from tender data."""
    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SECOP II Monitoring Report - {datetime.now().strftime('%Y-%m-%d %H:%M')}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background: linear-gradient(135deg, #005b99 0%, #0077cc 100%);
                color: white;
                padding: 30px;
                border-radius: 10px;
                margin-bottom: 30px;
            }}
            .header h1 {{
                margin: 0;
                font-size: 1.8rem;
            }}
            .header p {{
                margin: 10px 0 0 0;
                opacity: 0.9;
            }}
            .tender {{
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }}
            .tender h3 {{
                color: #005b99;
                margin-top: 0;
            }}
            .tender .meta {{
                color: #6c757d;
                font-size: 0.9rem;
                margin: 10px 0;
            }}
            .tender .badge {{
                display: inline-block;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 0.8rem;
                font-weight: 600;
                margin-top: 10px;
            }}
            .badge-medical {{
                background: #e3f2fd;
                color: #1976d2;
            }}
            .badge-furniture {{
                background: #fff3e0;
                color: #f57c00;
            }}
            .no-tenders {{
                text-align: center;
                padding: 40px;
                color: #6c757d;
                font-size: 1.1rem;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔍 SECOP II Monitoring Report</h1>
            <p>Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')} UTC</p>
            <p>Region: {REGION_ATLANTICO} | Categories: Medical & Furniture | Last {HOURS_TO_FILTER} hours</p>
        </div>
    """
    
    if tenders:
        for tender in tenders:
            category_badge_class = 'badge-medical' if tender.get('category') == 'medical' else 'badge-furniture'
            category_label = 'Medical' if tender.get('category') == 'medical' else 'Furniture'
            
            html += f"""
            <div class="tender">
                <h3>{tender.get('objeto_contrato', 'No title')}</h3>
                <div class="meta">
                    <strong>Entity:</strong> {tender.get('nombre_entidad', 'N/A')}<br>
                    <strong>Department:</strong> {tender.get('departamento', 'N/A')}<br>
                    <strong>Published:</strong> {tender.get('fecha_publicacion', 'N/A')}<br>
                    <strong>Value:</strong> {tender.get('valor_contrato', 'N/A')}
                </div>
                <span class="badge {category_badge_class}">{category_label}</span>
            </div>
            """
    else:
        html += """
        <div class="no-tenders">
            <p>No tenders found matching the criteria in the last 48 hours.</p>
        </div>
        """
    
    html += """
        </body>
    </html>
    """
    
    return html

def send_email(html_report):
    """Send HTML report via SMTP email."""
    if not all([SENDER_EMAIL, SENDER_PASSWORD, RECEIVER_EMAIL]):
        print("SMTP credentials not configured. Skipping email send.")
        return False
    
    try:
        print("Sending email report...")
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"SECOP II Monitoring Report - {datetime.now().strftime('%Y-%m-%d')}"
        msg['From'] = SENDER_EMAIL
        msg['To'] = RECEIVER_EMAIL
        
        # Attach HTML report
        html_part = MIMEText(html_report, 'html')
        msg.attach(html_part)
        
        # Connect to SMTP server and send
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        
        print("Email sent successfully!")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def main():
    """Main execution function."""
    print("=" * 60)
    print("SECOP II Monitoring Agent - Domédicos del Norte")
    print("=" * 60)
    
    # Fetch tenders
    tenders = fetch_tenders()
    
    if not tenders:
        print("No tenders fetched. Exiting.")
        return
    
    # Filter by region and category
    filtered_tenders = filter_by_region_and_category(tenders)
    
    # Filter by recent publication (48 hours)
    recent_tenders = filter_recent_tenders(filtered_tenders)
    
    # Generate HTML report
    html_report = generate_html_report(recent_tenders)
    
    # Save report to file
    report_path = f"secop_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html_report)
    print(f"Report saved to: {report_path}")
    
    # Send email
    send_email(html_report)
    
    print("=" * 60)
    print("SECOP II Agent execution completed successfully.")
    print("=" * 60)

if __name__ == "__main__":
    main()

