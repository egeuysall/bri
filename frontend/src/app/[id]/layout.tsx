import type { Metadata } from 'next';
import React from 'react';

function getTitle(text: string): string {
  if (!text) return '';

  // Extract the first # heading
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('#')) {
      // Remove all # characters and trim
      return trimmedLine.replace(/^#+\s*/, '').trim();
    }
  }

  return '';
}

function getShortDescription(text: string, maxLength = 165): string {
  if (!text) return '';

  // Remove the first # heading line
  const lines = text.split('\n');
  let contentWithoutTitle = text;
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i]?.trim() || '';
    if (trimmedLine.startsWith('#')) {
      // Remove this line and everything before it
      contentWithoutTitle = lines.slice(i + 1).join('\n');
      break;
    }
  }

  // Remove markdown characters
  const cleaned = contentWithoutTitle
    .replace(/[#*_~`>\[\]()]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  const trimmed = cleaned.slice(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(' ');
  return trimmed.slice(0, lastSpace > 0 ? lastSpace : maxLength) + '...';
}

export const revalidate = 3600;
export const dynamic = 'auto';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { id } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  let res;
  try {
    res = await fetch(`${apiUrl}/${id}`);
  } catch (error) {
    console.error('Error fetching post metadata:', error);
    return {
      title: 'Post Not Found',
      description: 'The requested post could not be found.',
      openGraph: { type: 'article' },
      twitter: { card: 'summary' },
    };
  }

  if (!res.ok) {
    return {
      title: 'Post Not Found',
      description: 'The requested post could not be found.',
      openGraph: { type: 'article' },
      twitter: { card: 'summary' },
    };
  }

  let post;
  try {
    const json = await res.json();
    post = json.data;
    if (!post) {
      throw new Error('Post data is missing');
    }
  } catch (error) {
    console.error('Error parsing post data:', error);
    return {
      title: 'Post Not Found',
      description: 'The requested post could not be found.',
      openGraph: { type: 'article' },
      twitter: { card: 'summary' },
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bridge.egeuysal.com';
  const canonical = `${siteUrl.replace(/\/$/, '')}/${id}`;
  const title = getTitle(post?.content || '');
  const shortDesc = getShortDescription(post?.content || '');

  const metadata: Metadata = {
    title: title,
    description: shortDesc,
    openGraph: {
      title: title,
      description: shortDesc,
      url: canonical,
      type: 'article',
    },
    twitter: {
      description: shortDesc,
    },
    alternates: { canonical },
  };

  return metadata;
}

// Default export for the layout as a React component
export default function idLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
