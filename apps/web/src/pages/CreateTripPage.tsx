import { useSearchParams } from 'react-router';
import { PagePlaceholder } from '../components/PagePlaceholder';

export default function CreateTripPage() {
  const [params] = useSearchParams();
  const from = params.get('from');
  return (
    <PagePlaceholder
      title={from ? 'Copy this plan' : 'Create a trip'}
      spec="frontend-spec §3.2 (F1, F6, F10, F12)"
    />
  );
}
