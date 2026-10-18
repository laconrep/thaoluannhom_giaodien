import { Skeleton } from "@/components/ui/skeleton"

/**
 * T7: skeleton hiện trong lúc chuyển tab (danh sách / phiên / điểm / chia sẻ)
 * thay vì để trống hoặc treo nội dung cũ. File này bọc mọi page con của lớp.
 */
export default function ClassLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải nội dung">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
