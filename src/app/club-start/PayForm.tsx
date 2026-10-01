'use client';
import {useWebsiteInternational} from '../../components/InternationalProvider';
import {useFormState} from 'react-dom';
import {payClubSignup} from '../../lib/club-onboarding-actions';
import {SubmitButton} from '../../components/SubmitButton';
export function PayForm(){const {tr}=useWebsiteInternational();const [state,action]=useFormState(payClubSignup,null);return <form action={action} className="space-y-3"><SubmitButton className="btn-court" pendingText={tr("Åbner betaling…")}>{tr("Betal abonnement")}</SubmitButton>{state?.error&&<p role="alert">{tr(state.error)}</p>}</form>;}
