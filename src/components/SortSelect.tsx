import '../styles/components/SortSelect.css';

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface SortSelectProps<T extends string> {
  value: T;
  options: Array<SortOption<T>>;
  onChange: (value: T) => void;
  label?: string;
}

export function SortSelect<T extends string>({
  value,
  options,
  onChange,
  label = 'Сортировка',
}: SortSelectProps<T>) {
  return (
    <label className="sort-select">
      <span>{label}</span>
      <select
        className="sort-select-control"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
