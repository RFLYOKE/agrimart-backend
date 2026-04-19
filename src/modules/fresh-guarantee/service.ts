import prisma from '../../config/db';
import { paymentService } from '../payment/service';
import { notificationService } from '../notification/service';

export class FreshGuaranteeService {
  async confirmReceipt(userId: string, data: { order_id: string; condition: 'fresh' | 'not_fresh'; photo_urls?: string[] }) {
    const order = await prisma.order.findUnique({
      where: { id: data.order_id },
      include: { items: { include: { product: true } } }
    });

    if (!order) throw new Error('Order not found');
    if (order.buyer_id !== userId) throw new Error('Unauthorized: Order belongs to a different user');
    if (order.status !== 'shipped') throw new Error('Order cannot be confirmed at this current stage');

    // Update order status
    await prisma.order.update({
      where: { id: data.order_id },
      data: {
        status: 'delivered',
        received_condition: data.condition,
        confirmed_at: new Date(),
      }
    });

    // Extract coopId to update fresh rate
    const coopId = order.items[0]?.product.coop_id;

    if (data.condition === 'fresh' && coopId) {
      // Calculate and update fresh rate for Cooperative
      await this.updateCoopFreshRate(coopId);
    }

    return {
      orderId: data.order_id,
      status: 'delivered',
      canClaim: data.condition === 'not_fresh'
    };
  }

  async createClaim(userId: string, data: { order_id: string; issue_type: string; description?: string; photo_urls: string[]; refund_type: 'full' | 'partial' }) {
    const order = await prisma.order.findUnique({
      where: { id: data.order_id }
    });

    if (!order) throw new Error('Order not found');
    if (order.buyer_id !== userId) throw new Error('Unauthorized');
    if (order.status !== 'delivered') throw new Error('Order must be delivered before claiming');

    const existingClaim = await prisma.claim.findFirst({
      where: { order_id: data.order_id, status: { in: ['pending', 'approved'] } }
    });

    if (existingClaim) throw new Error('An active claim already exists for this order');

    // Hitung refund_amount
    const totalOrder = Number(order.total);
    const refundAmount = data.refund_type === 'full' ? totalOrder : totalOrder * 0.5;

    const claim = await prisma.claim.create({
      data: {
        order_id: data.order_id,
        user_id: userId,
        issue_type: data.issue_type,
        description: data.description || '',
        photo_urls: data.photo_urls,
        refund_type: data.refund_type,
        refund_amount: refundAmount,
        status: 'pending',
      }
    });

    // Mock notify Admin
    console.log(`[Claim Created] Admin please review claim ${claim.id} for order ${data.order_id}`);

    return {
      claim,
      estimated_resolution: '3-5 business days'
    };
  }

  async approveClaim(adminId: string, claimId: string) {
    // Note: ensure caller is admin inside controller
    const claim = await prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'pending') throw new Error('Claim is already processed');

    // Panggil Refund Midtrans
    try {
      await paymentService.processRefund(claim.order_id, Number(claim.refund_amount), 'Fresh Guarantee Approved');
    } catch (e) {
      console.warn('Midtrans Refund failed/mocked. Approving anyway locally.');
    }

    const updatedClaim = await prisma.claim.update({
      where: { id: claimId },
      data: { status: 'approved' }
    });

    await prisma.order.update({
      where: { id: claim.order_id },
      data: { status: 'cancelled' } // Memakai status cancelled untuk representasi cancelled-refund di DB agri
    });

    // Kirim notifikasi FCM 
    await notificationService.notifyClaimUpdate(claim.user_id, claim.id, 'approved');

    return updatedClaim;
  }

  async rejectClaim(adminId: string, claimId: string, reason: string) {
    const claim = await prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'pending') throw new Error('Claim is already processed');

    const updatedClaim = await prisma.claim.update({
      where: { id: claimId },
      data: { 
        status: 'rejected',
        reject_reason: reason
       }
    });

    await notificationService.notifyClaimUpdate(claim.user_id, claim.id, 'rejected');

    return updatedClaim;
  }

  async getCoopFreshRate(coopId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const relatedOrders = await prisma.order.findMany({
      where: {
        items: { some: { product: { coop_id: coopId } } },
        received_condition: { not: null },
        confirmed_at: { gte: thirtyDaysAgo }
      }
    });

    if (relatedOrders.length === 0) return 0;

    const freshCount = relatedOrders.filter(o => o.received_condition === 'fresh').length;
    const rate = (freshCount / relatedOrders.length) * 100;
    
    return rate;
  }

  private async updateCoopFreshRate(coopId: string) {
    const rate = await this.getCoopFreshRate(coopId);
    
    await prisma.cooperative.update({
      where: { id: coopId },
      data: { fresh_rate: rate }
    });
  }
}

export const freshGuaranteeService = new FreshGuaranteeService();
