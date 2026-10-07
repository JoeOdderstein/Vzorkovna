import { handleNotifyRepairComment } from '../notifyRepairComment.js';

export default async function installationsNotifyRepairComment(req, res) {
  return handleNotifyRepairComment(req, res);
}
