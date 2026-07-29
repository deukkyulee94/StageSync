import { SUBWAY_STATIONS } from "@/lib/subway";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  onlyWithPracticeRoom?: boolean;
}

export function StationSelect({
  id,
  label,
  value,
  onChange,
  allowEmpty = true,
  onlyWithPracticeRoom = false,
}: Props) {
  const stations = onlyWithPracticeRoom
    ? SUBWAY_STATIONS.filter((s) => s.hasPracticeRoom)
    : SUBWAY_STATIONS;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">선택 안 함</option>}
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.line})
            {s.hasPracticeRoom ? " · 연습실" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
