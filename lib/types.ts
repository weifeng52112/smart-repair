export const AREAS = ["A区", "B区", "C区"] as const;
export const DEVICES = ["电脑", "打印机", "投影仪"] as const;
export const STATUSES = ["待处理", "处理中", "已完成"] as const;

export type Area = (typeof AREAS)[number];
export type Device = (typeof DEVICES)[number];
export type TicketStatus = (typeof STATUSES)[number];

export type Ticket = {
  id: string;
  name: string;
  area: string;
  device: string;
  description: string;
  status: TicketStatus;
  suggestions: string[];
  created_at: string;
};

export type NewTicket = Pick<Ticket, "name" | "area" | "device" | "description">;

export function statusStyle(status: string): string {
  switch (status) {
    case "已完成":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "处理中":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function deviceIcon(device: string): string {
  switch (device) {
    case "打印机":
      return "🖨️";
    case "投影仪":
      return "📽️";
    default:
      return "💻";
  }
}

export function nextStatus(status: TicketStatus): TicketStatus {
  if (status === "待处理") return "处理中";
  if (status === "处理中") return "已完成";
  return "待处理";
}
