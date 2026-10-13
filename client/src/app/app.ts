import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly villages = [
    'Attanthangal',
    'Chikkarayapuram',
    'Erumaiyur',
    'Kilambakkam',
    'Kunrathur',
    'Madambakkam',
    'Nedungundram',
    'Ottiyambakkam',
    'Pallavaram',
    'Perungalathur-Vandalur',
    'Pottur-Pammadukulam',
    'Puzhal',
    'Sembakkam-Nanmangalam',
    'Sirukalathur-Nandambakkam',
    'Sithalapakkam',
    'St.Thomas Mount Contonment',
    'Thiruneermalai',
    'Thiruneermalai-Kadaperi',
    'Tirusulam',
    'Tondiarpet',
    'V.O.C Nagar',
  ];

  protected loading = false;
  protected statusMessage = '';

  async openMap(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const village = String(formData.get('village') ?? '').trim();

    if (!village) {
      this.statusMessage = 'Please select a village.';
      return;
    }

    // Open the tab during the click, so the browser allows it.
    const mapTab = window.open('about:blank', '_blank');

    if (!mapTab) {
      this.statusMessage = 'Allow pop-ups for this site, then try again.';
      return;
    }

    this.loading = true;
    this.statusMessage = 'Finding the official map...';

    try {
      const response = await fetch('http://localhost:3000/api/cmda/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ village }),
      });

      const result = (await response.json()) as {
        village?: string;
        mapUrl?: string;
        message?: string;
      };

      if (!response.ok || !result.mapUrl) {
        throw new Error(result.message || 'Map lookup failed.');
      }

      mapTab.location.href = result.mapUrl;
      this.statusMessage = `Opening the CMDA map for ${result.village ?? village}.`;
    } catch (error: unknown) {
      mapTab.close();
      this.statusMessage = error instanceof Error ? error.message : 'Map lookup failed.';
    } finally {
      this.loading = false;
    }
  }
}
