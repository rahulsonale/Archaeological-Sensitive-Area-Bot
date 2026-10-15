import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';

interface MapRemark {
  zone: string;
  remark: string;
}

interface SearchResult {
  village: string;
  mapImageUrl: string;
  remarks: MapRemark[];
  note: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  result = signal<SearchResult | null>(null);
  error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch(
        'http://localhost:3000/output/latest-result.json'
      );

      if (!response.ok) {
        throw new Error('No search result is available yet.');
      }

      this.result.set(await response.json() as SearchResult);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Could not load the latest map result.'
      );
    }
  }
}