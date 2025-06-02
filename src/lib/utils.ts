import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Member } from '../types';
import { supabase } from './supabase';
import { format, addHours, parseISO, subDays } from 'date-fns';
import toast from 'react-hot-toast';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Function to convert UTC to GMT+8
// Use ONLY for display, not for querying/filtering
export function toGMT8(date: Date | string): Date {
  const utcDate = new Date(date);
  return addHours(utcDate, 8);
}

// Function to format date to GMT+8
// Use ONLY for display, not for querying/filtering
export function formatGMT8(date: Date | string, formatStr: string): string {
  return format(toGMT8(new Date(date)), formatStr);
}

export function validateNRIC(nric: string): boolean {
  // Malaysian NRIC format: YYMMDD-PB-###G
  const nricRegex = /^(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-?([0-9]{2})-?([0-9]{3,4})$/;
  return nricRegex.test(nric.replace(/-/g, ''));
}

export function getAgeFromNRIC(nric: string): number {
  const cleanNRIC = nric.replace(/-/g, '');
  const year = parseInt(cleanNRIC.substring(0, 2));
  const currentYear = new Date().getFullYear() % 100;
  const fullYear = year <= currentYear ? 2000 + year : 1900 + year;
  const month = parseInt(cleanNRIC.substring(2, 4)) - 1;
  const day = parseInt(cleanNRIC.substring(4, 6));
  
  const birthDate = new Date(fullYear, month, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

export function formatNRIC(nric: string): string {
  const cleaned = nric.replace(/-/g, '');
  return cleaned.slice(0, 6) + '-' + cleaned.slice(6, 8) + '-' + cleaned.slice(8);
}

export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

export function exportToCSV<T extends Record<string, any>>(data: T[], filename: string): void {
  // Convert object keys to header row
  const headers = Object.keys(data[0]);
  
  // Convert data to CSV rows
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle special cases
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return '"' + value.replace(/"/g, '""') + '"';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (value instanceof Date) return formatGMT8(value, 'yyyy-MM-dd HH:mm:ss');
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Formats an ISO date string to show the day *before* the given date.
 * Useful for displaying the "last valid day" of a membership.
 * Example: expiry_date '2025-05-12' -> returns '11 May 2025'
 */
export function formatLastValidDay(dateString: string): string {
  if (!dateString) {
    return '-';
  }
  try {
    const expiryDate = parseISO(dateString); // Use parseISO for reliability
    const lastValidDate = subDays(expiryDate, 1);
    return format(lastValidDate, 'dd MMM yyyy');
  } catch (error) {
    console.error("Error formatting last valid day:", error);
    // Fallback to original date if parsing/subtraction fails
    try {
      return format(parseISO(dateString), 'dd MMM yyyy');
    } catch {
      return 'Invalid Date'; // Fallback if even original fails
    }
  }
}

export async function calculateMemberStatus(
  expiryDate: string,
  currentStatus: Member['status']
): Promise<Member['status']> {
  try {
    // If member is suspended, maintain suspended status
    if (currentStatus === 'suspended') {
      return 'suspended';
    }

    // Get grace period from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'membership')
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return currentStatus;
    }

    const gracePeriodDays = settings?.value?.grace_period_days || 7;
    const now = toGMT8(new Date());
    const expiry = toGMT8(new Date(expiryDate));
    const graceDate = new Date(expiry);
    graceDate.setDate(graceDate.getDate() + gracePeriodDays);

    // Calculate new status based on dates
    if (expiry > now) {
      return 'active';
    } else if (graceDate > now) {
      return 'grace';
    } else {
      return 'expired';
    }
  } catch (error) {
    console.error('Error calculating member status:', error);
    return currentStatus; // Return current status if calculation fails
  }
}

export async function updateMemberStatus(member: Member): Promise<void> {
  try {
    const newStatus = await calculateMemberStatus(member.expiry_date, member.status);
    
    if (newStatus !== member.status) {
      const { error } = await supabase
        .from('members')
        .update({ status: newStatus })
        .eq('id', member.id);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating member status:', error);
    throw error;
  }
}

// Create a cache for audio elements
// const audioCache: { [key: string]: HTMLAudioElement } = {};

export function playStatusSound(status: Member['status']): Promise<void> {
  return new Promise((resolve) => {
    try {
      let audioPath: string;
      
      // Use public domain sounds from Pixabay
      switch (status) {
        case 'active':
          audioPath = 'https://cdn.pixabay.com/audio/2022/03/15/audio_163a75c6ce.mp3'; // Success chime
          break;
        case 'grace':
          audioPath = 'https://cdn.pixabay.com/audio/2022/11/17/audio_8049345f8b.mp3'; // Subtle notification
          break;
        case 'expired':
          audioPath = 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8f90efa8b.mp3'; // Error sound
          break;
        case 'suspended':
          audioPath = 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8f90efa8b.mp3'; // Error sound
          break;
        default:
          audioPath = 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8f90efa8b.mp3'; // Default error sound
      }

      const audio = new Audio(audioPath);

      // Reset audio to start
      // audio.currentTime = 0; // Not needed for new Audio element

      // Play the sound
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Add event listener for when audio finishes playing
            audio.onended = () => resolve();
          })
          .catch((error) => {
            console.warn('Audio playback failed:', error);
            resolve(); // Resolve anyway to not block the flow
          });
      } else {
        // Fallback for browsers where play() doesn't return a promise
        audio.onended = () => resolve();
      }
    } catch (error) {
      console.warn('Error setting up audio:', error);
      resolve(); // Resolve anyway to not block the flow
    }
  });
}