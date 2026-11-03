/**
 * Swiftbase Declarative Schema Column Builders
 *
 * Provides a Drizzle-style type-safe column definition API supporting both
 * OLTP (LibSQL / SQLite) and OLAP (DuckLake / DuckDB) database engines.
 */

export type ColumnDataType =
  | "text"
  | "varchar"
  | "integer"
  | "bigint"
  | "real"
  | "double"
  | "boolean"
  | "timestamp"
  | "json"
  | "uuid"
  | "blob";

export interface ColumnDefinitionOptions {
  name: string;
  dataType: ColumnDataType;
  isPrimaryKey?: boolean;
  isNotNull?: boolean;
  isUnique?: boolean;
  defaultValue?: any;
  references?: () => ColumnBuilder<any>;
  length?: number;
}

export class ColumnBuilder<T = any> {
  public options: ColumnDefinitionOptions;

  constructor(name: string, dataType: ColumnDataType, length?: number) {
    this.options = {
      name,
      dataType,
      length,
      isPrimaryKey: false,
      isNotNull: false,
      isUnique: false,
    };
  }

  public primaryKey(): this {
    this.options.isPrimaryKey = true;
    this.options.isNotNull = true;
    return this;
  }

  public notNull(): this {
    this.options.isNotNull = true;
    return this;
  }

  public unique(): this {
    this.options.isUnique = true;
    return this;
  }

  public default(value: any): this {
    this.options.defaultValue = value;
    return this;
  }

  public references(refFn: () => ColumnBuilder<any>): this {
    this.options.references = refFn;
    return this;
  }

  public get name(): string {
    return this.options.name;
  }

  public get dataType(): ColumnDataType {
    return this.options.dataType;
  }
}

// Fluent Column Factories
export function text(name: string): ColumnBuilder<string> {
  return new ColumnBuilder<string>(name, "text");
}

export function varchar(name: string, options?: { length: number }): ColumnBuilder<string> {
  return new ColumnBuilder<string>(name, "varchar", options?.length);
}

export function integer(name: string): ColumnBuilder<number> {
  return new ColumnBuilder<number>(name, "integer");
}

export function bigint(name: string): ColumnBuilder<bigint> {
  return new ColumnBuilder<bigint>(name, "bigint");
}

export function real(name: string): ColumnBuilder<number> {
  return new ColumnBuilder<number>(name, "real");
}

export function doublePrecision(name: string): ColumnBuilder<number> {
  return new ColumnBuilder<number>(name, "double");
}

export function boolean(name: string): ColumnBuilder<boolean> {
  return new ColumnBuilder<boolean>(name, "boolean");
}

export function timestamp(name: string): ColumnBuilder<Date | string> {
  return new ColumnBuilder<Date | string>(name, "timestamp");
}

export function json(name: string): ColumnBuilder<any> {
  return new ColumnBuilder<any>(name, "json");
}

export function uuid(name: string): ColumnBuilder<string> {
  return new ColumnBuilder<string>(name, "uuid");
}

export function blob(name: string): ColumnBuilder<Uint8Array> {
  return new ColumnBuilder<Uint8Array>(name, "blob");
}
