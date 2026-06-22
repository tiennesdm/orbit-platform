'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Tag, MapPin, Filter, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Listing {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  status: 'active' | 'sold' | 'reserved';
  images: string[];
  category: string;
  location?: string;
  sellerHandle: string;
  createdAt: string;
}

const MOCK_LISTINGS: Listing[] = [
  {
    id: 'l1', title: 'Vintage Typewriter (Working)', description: 'A 1962 Olympia portable typewriter. Recently serviced. New ribbon.',
    priceCents: 450000, currency: 'INR', status: 'active', images: [], category: 'Vintage',
    location: 'Mumbai, MH', sellerHandle: 'alice', createdAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
  },
  {
    id: 'l2', title: 'Handmade Leather Notebook', description: 'Hand-stitched, vegetable-tanned leather. 80gsm paper, 120 pages.',
    priceCents: 35000, currency: 'INR', status: 'active', images: [], category: 'Stationery',
    location: 'Bangalore, KA', sellerHandle: 'bob', createdAt: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
  },
  {
    id: 'l3', title: 'Mechanical Keyboard (Custom)', description: 'Cherry MX Browns, PBT keycaps, brass weight. Lubed stabs.',
    priceCents: 1200000, currency: 'INR', status: 'active', images: [], category: 'Electronics',
    location: 'Delhi, DL', sellerHandle: 'carol', createdAt: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
  },
  {
    id: 'l4', title: 'Camera Lens 50mm f/1.4', description: 'Mint condition. Original box, hood, caps.',
    priceCents: 2800000, currency: 'INR', status: 'active', images: [], category: 'Photography',
    location: 'Pune, MH', sellerHandle: 'diana', createdAt: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
  },
];

const CATEGORIES = ['All', 'Electronics', 'Vintage', 'Stationery', 'Photography', 'Clothing', 'Home', 'Other'];

export default function MarketplacePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>(MOCK_LISTINGS);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);

  const filtered = listings.filter((l) => {
    if (category !== 'All' && l.category !== category) return false;
    if (search && !`${l.title} ${l.description}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-hairline">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1">Marketplace</h1>
          <button
            onClick={() => setComposing(true)}
            className="bg-accent text-white p-2 rounded-full"
            aria-label="New listing"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings…"
              className="w-full pl-9 pr-3 py-2 bg-bg-subtle rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                category === c ? 'bg-accent text-white' : 'bg-bg-subtle text-text-secondary',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {composing ? (
        <ComposeListing onClose={() => setComposing(false)} />
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {filtered.map((l) => (
            <article key={l.id} className="bg-bg-subtle rounded-xl overflow-hidden">
              <div className="aspect-square bg-gradient-to-br from-bg-elevated to-bg-subtle flex items-center justify-center text-3xl">
                {l.category === 'Electronics' && '⌨️'}
                {l.category === 'Vintage' && '⌨️'}
                {l.category === 'Stationery' && '📓'}
                {l.category === 'Photography' && '📷'}
                {l.category === 'Clothing' && '👕'}
                {l.category === 'Home' && '🏠'}
                {l.category === 'Other' && '📦'}
              </div>
              <div className="p-3">
                <p className="font-semibold text-sm line-clamp-2">{l.title}</p>
                <p className="text-base font-bold text-accent mt-1">
                  ₹{(l.priceCents / 100).toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-text-tertiary mt-1 flex items-center gap-1">
                  <MapPin size={9} /> {l.location || 'India'} · @{l.sellerHandle}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ComposeListing({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceInr, setPriceInr] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [location, setLocation] = useState('');
  const [posting, setPosting] = useState(false);

  async function post() {
    if (!title || !priceInr) return;
    setPosting(true);
    try {
      await api.marketplace.create({
        title,
        description,
        priceCents: Math.round(parseFloat(priceInr) * 100),
        currency: 'INR',
        category,
        location,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold">New listing</h2>
      <div className="aspect-video bg-bg-subtle border-2 border-dashed border-hairline rounded-lg flex items-center justify-center text-text-tertiary">
        + Add photos
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g., Vintage Typewriter)"
        className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description, condition, dimensions…"
        className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-text-tertiary">Price (₹)</label>
          <input
            type="number"
            value={priceInr}
            onChange={(e) => setPriceInr(e.target.value)}
            placeholder="4500"
            className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {CATEGORIES.filter((c) => c !== 'All').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (e.g., Mumbai, MH)"
        className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-bg-subtle">
          Cancel
        </button>
        <button
          onClick={post}
          disabled={!title || !priceInr || posting}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white disabled:opacity-50"
        >
          {posting ? 'Posting…' : 'List for sale'}
        </button>
      </div>
    </div>
  );
}
