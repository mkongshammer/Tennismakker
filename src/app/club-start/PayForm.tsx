'use client';
import {useFormState} from 'react-dom';
import {payClubSignup} from '../../lib/club-onboarding-actions';
import {SubmitButton} from '../../components/SubmitButton';
export function PayForm(){const [state,action]=useFormState(payClubSignup,null);return <form action={action} className="space-y-3"><SubmitButton className="btn-court" pendingText="Åbner betaling…">Betal abonnement</SubmitButton>{state?.error&&<p role="alert">{state.error}</p>}</form>;}
