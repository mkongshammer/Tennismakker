import Stripe from 'stripe';
import {confirmWalletTopup,freezeWalletForPayment,expireWalletTopup} from './wallet';
import {db} from './db';
import {recordClubSubscriptionFailure,refreshClubSignup} from './club-onboarding';
import {stripe} from './stripe';
import {confirmBookingPayment} from './payments';
import {refreshAccountStatus,findRecipientByAccountId} from './connect';
import {confirmPackagePurchase} from './packages';
import {confirmMembership} from './memberships';
import {confirmTeamSignup} from './teams';
import {confirmPunchPurchase} from './punch-cards';
import {syncSubscription} from './subscription';
import {checkoutIsSettled} from './payment-validation';

export async function handleStripeEvent(type:string,object:any){
  switch(type){
    case 'invoice.paid':{
      const customerId=typeof object.customer==='string'?object.customer:object.customer?.id;
      if(customerId){const club=await db.club.findFirst({where:{stripeCustomerId:customerId,signupManaged:true}});if(club)await refreshClubSignup(club.id);}
      return;
    }
    case 'invoice.payment_failed':{
      const customerId=typeof object.customer==='string'?object.customer:object.customer?.id;
      if(customerId){const failure=await recordClubSubscriptionFailure(customerId,new Date());if(failure?.clubId)await refreshClubSignup(failure.clubId);}
      return;
    }
    case 'checkout.session.expired':{
      const id=object.metadata?.walletTopupId;
      if(id)await expireWalletTopup(id,object.id);
      return;
    }
    case 'payment_intent.succeeded':{
      const saleId=object.metadata?.shopSaleId;
      if(saleId){const {confirmReaderSale}=await import('./terminal');await confirmReaderSale(saleId);}
      return;
    }
    case 'charge.refunded':
    case 'charge.dispute.created':{
      const pi=typeof object.payment_intent==='string'?object.payment_intent:object.payment_intent?.id;
      if(pi)await freezeWalletForPayment(pi);
      return;
    }
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':{
      const session=object as Stripe.Checkout.Session;
      if(session.mode==='subscription'){
        const subscriptionId=typeof session.subscription==='string'?session.subscription:session.subscription?.id;
        if(subscriptionId){const sub=await (await stripe()).subscriptions.retrieve(subscriptionId);await syncSubscription(sub as any);}
        return;
      }
      if(!checkoutIsSettled(session))return;
      if(session.metadata?.walletTopupId){await confirmWalletTopup(session);return;}
      const teamSignupId=session.metadata?.teamSignupId;if(teamSignupId){await confirmTeamSignup(teamSignupId,session);return;}
      const eventSignupId=session.metadata?.eventSignupId;if(eventSignupId){const {confirmEventSignup}=await import('./events');await confirmEventSignup(eventSignupId,session);return;}
      const giftCardId=session.metadata?.giftCardId;if(giftCardId){const {confirmGiftCard}=await import('./shop');await confirmGiftCard(giftCardId,session);return;}
      const punchPurchaseId=session.metadata?.punchPurchaseId;if(punchPurchaseId){await confirmPunchPurchase(punchPurchaseId,session);return;}
      const membershipId=session.metadata?.membershipId;if(membershipId){await confirmMembership(membershipId,session);return;}
      const purchaseId=session.metadata?.purchaseId;if(purchaseId){await confirmPackagePurchase(purchaseId,session);return;}
      const bookingId=session.metadata?.bookingId;
      if(!bookingId){console.error('checkout.session.completed uden bookingId i metadata',session.id);return;}
      await confirmBookingPayment(bookingId,{provider:'stripe',session});
      return;
    }
    case 'account.updated':{
      const account=object as Stripe.Account;
      const recipient=await findRecipientByAccountId(account.id);
      if(recipient)await refreshAccountStatus(recipient.kind,recipient.id);
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(object as any);return;
    default:return;
  }
}
