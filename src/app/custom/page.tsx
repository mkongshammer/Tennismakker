import { permanentRedirect } from 'next/navigation';

// Existing links now lead straight to plans, prices and club signup.
export default function CustomPage() {
  permanentRedirect('/opret-klub');
}
