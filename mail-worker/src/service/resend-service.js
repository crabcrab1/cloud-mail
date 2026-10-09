import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';

const resendService = {

  async webhooks(c, body) {

    //Brevo 回調（帶有 event 與 message-id 欄位）
    if (body && body.event && body['message-id']) {
      return await this.brevoWebhooks(c, body);
    }

    const params = {
      resendEmailId: body.data.email_id,
      status: emailConst.status.SENT
    }

    if (body.type === 'email.delivered') {
      params.status = emailConst.status.DELIVERED
      params.message = null
    }

    if (body.type === 'email.complained') {
      params.status = emailConst.status.COMPLAINED
      params.message = null
    }

    if (body.type === 'email.bounced') {
      let bounce = body.data.bounce
      bounce = JSON.stringify(bounce);
      params.status = emailConst.status.BOUNCED
      params.message = bounce
    }

    if (body.type === 'email.delivery_delayed') {
      params.status = emailConst.status.DELAYED
      params.message = null
    }

    if (body.type === 'email.failed') {
      params.status = emailConst.status.FAILED
      params.message = body.data.failed.reason
    }

    const emailRow = await emailService.updateEmailStatus(c, params)

    if (!emailRow) {
      throw new BizError('更新邮件状态记录失败');
    }

  },

  async brevoWebhooks(c, body) {

    const params = {
      resendEmailId: String(body['message-id']).replace(/^<|>$/g, ''),
      status: null,
      message: null
    };
    const reason = body.reason || '';

    switch (body.event) {
      case 'delivered':
        params.status = emailConst.status.DELIVERED;
        break;
      case 'deferred':
      case 'soft_bounce':
        params.status = emailConst.status.DELAYED;
        break;
      case 'hard_bounce':
      case 'blocked':
      case 'invalid_email':
        params.status = emailConst.status.BOUNCED;
        params.message = JSON.stringify({ message: reason || body.event });
        break;
      case 'spam':
        params.status = emailConst.status.COMPLAINED;
        break;
      case 'error':
        params.status = emailConst.status.FAILED;
        params.message = reason || 'error';
        break;
      default:
        return; //opened、click 等事件忽略
    }

    //找不到對應郵件時不報錯，避免 Brevo 重複回調
    await emailService.updateEmailStatus(c, params);
  }
}

export default resendService
