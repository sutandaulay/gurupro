import * as React from 'react';
import { cn } from '@/lib/utils';

interface DataTableProps<TData> extends React.HTMLAttributes<HTMLDivElement> {
  columns: any[]; // Dalam implementasi nyata, ini akan memiliki tipe yang lebih ketat
  data: TData[];
}

/**
 * @deprecated Komponen ini adalah placeholder. 
 * Gunakan komponen tabel bawaan Radix UI atau implementasi tabel kustom sesuai kebutuhan.
 */
export function DataTable<TData>({ 
  className, 
  columns, 
  data, 
  ...props 
}: DataTableProps<TData>) {
  return (
    <div className={cn("rounded-md border", className)} {...props}>
      <table className="w-full caption-bottom text-sm">
        <thead className="[&_tr]:border-b">
          <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
            {columns.map((column, index) => (
              <th 
                key={index} 
                className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {data.map((row: any, rowIndex: number) => (
            <tr 
              key={rowIndex} 
              className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
            >
              {columns.map((column, colIndex) => (
                <td 
                  key={colIndex} 
                  className="p-4 align-middle [&:has([role=checkbox])]:pr-0"
                >
                  {column.cell ? column.cell({ row }) : row[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}