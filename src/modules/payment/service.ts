import crypto from 'crypto';
import prisma from '../../config/db';
import { snap, coreApi } from '../../config/midtrans';
import { env } from '../../config/env';
export class PaymentService {
  async createSnapTransaction(orderId: string, amount: number, customerDetails: any, itemDetails: any[]) {
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(amount), // Midtrans expects integer
      },
      customer_details: customerDetails,
      item_details: itemDetails,
    };

    const transaction = await snap.createTransaction(parameter);
    return {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    };
  }

  async handleWebhook(notification: any) {
    try {
      // Validate with Midtrans client to ensure payload is authentic
      const statusResponse = await snap.transaction.notification(notification);

      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      // Also manually verify signature just to be strictly secure as requested
      const payload = `${orderId}${statusResponse.status_code}${statusResponse.gross_amount}${env.MIDTRANS_SERVER_KEY}`;
      const hash = crypto.createHash('sha512').update(payload).digest('hex');
      
      if (hash !== statusResponse.signature_key) {
        throw new Error('Invalid signature key');
      }

      let newStatus: string | undefined;

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'accept') {
          newStatus = 'paid';
        }
      } else if (transactionStatus === 'settlement') {
        newStatus = 'paid';
      } else if (
        transactionStatus === 'cancel' ||
        transactionStatus === 'deny' ||
        transactionStatus === 'expire'
      ) {
        newStatus = 'cancelled';
      } else if (transactionStatus === 'pending') {
        newStatus = 'pending';
      }

      if (newStatus) {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: newStatus } as any,
        });

        // Mock notification to buyer
        console.log(`[Notification Service Mock] FCM sent to user ${order.buyer_id}: Payment status for ${orderId} is now ${newStatus}`);
      }

      return transactionStatus;
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }

  async checkTransactionStatus(orderId: string) {
    return snap.transaction.status(orderId);
  }

  async processRefund(orderId: string, amount: number, reason: string) {
    const parameter = {
      refund_key: `refund-${orderId}-${Date.now()}`,
      amount: Math.round(amount),
      reason,
    };
    return coreApi.transaction.refundDirect(orderId, parameter);
  }
}

export const paymentService = new PaymentService();
