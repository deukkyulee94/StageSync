import type { SubwayStation } from "@/types";

/**
 * 서울 주요 지하철역 샘플 데이터.
 * 연습실 유무는 목업 — 추후 실제 연습실 DB/API로 교체.
 */
export const SUBWAY_STATIONS: SubwayStation[] = [
  { id: "st-gangnam", name: "강남", line: "2호선", lat: 37.4979, lng: 127.0276, hasPracticeRoom: true },
  { id: "st-hongdae", name: "홍대입구", line: "2호선", lat: 37.5572, lng: 126.9254, hasPracticeRoom: true },
  { id: "st-sillim", name: "신림", line: "2호선", lat: 37.4842, lng: 126.9296, hasPracticeRoom: true },
  { id: "st-jamsil", name: "잠실", line: "2호선", lat: 37.5133, lng: 127.1001, hasPracticeRoom: true },
  { id: "st-sindorim", name: "신도림", line: "2호선", lat: 37.5088, lng: 126.891, hasPracticeRoom: true },
  { id: "st-seongsu", name: "성수", line: "2호선", lat: 37.5445, lng: 127.0557, hasPracticeRoom: true },
  { id: "st-hapjeong", name: "합정", line: "2호선", lat: 37.5495, lng: 126.9139, hasPracticeRoom: true },
  { id: "st-sinsa", name: "신사", line: "3호선", lat: 37.5164, lng: 127.0203, hasPracticeRoom: true },
  { id: "st-apgujeong", name: "압구정", line: "3호선", lat: 37.5274, lng: 127.0285, hasPracticeRoom: false },
  { id: "st-expressbus", name: "고속터미널", line: "3호선", lat: 37.5048, lng: 127.0045, hasPracticeRoom: true },
  { id: "st-myeongdong", name: "명동", line: "4호선", lat: 37.5635, lng: 126.983, hasPracticeRoom: false },
  { id: "st-hyehwa", name: "혜화", line: "4호선", lat: 37.5822, lng: 127.0018, hasPracticeRoom: true },
  { id: "st-dongdaemun", name: "동대문", line: "4호선", lat: 37.571, lng: 127.0095, hasPracticeRoom: true },
  { id: "st-sadang", name: "사당", line: "4호선", lat: 37.4765, lng: 126.9816, hasPracticeRoom: true },
  { id: "st-wangsimni", name: "왕십리", line: "5호선", lat: 37.5615, lng: 127.0374, hasPracticeRoom: true },
  { id: "st-yeouido", name: "여의도", line: "5호선", lat: 37.5216, lng: 126.9245, hasPracticeRoom: true },
  { id: "st-gongdeok", name: "공덕", line: "5호선", lat: 37.5443, lng: 126.9515, hasPracticeRoom: true },
  { id: "st-cheongnyangni", name: "청량리", line: "1호선", lat: 37.5802, lng: 127.045, hasPracticeRoom: false },
  { id: "st-seoulstation", name: "서울역", line: "1호선", lat: 37.5547, lng: 126.9707, hasPracticeRoom: false },
  { id: "st-noryangjin", name: "노량진", line: "1호선", lat: 37.5141, lng: 126.9416, hasPracticeRoom: true },
  { id: "st-isu", name: "이수", line: "7호선", lat: 37.4867, lng: 126.9822, hasPracticeRoom: true },
  { id: "st-geonidae", name: "건대입구", line: "7호선", lat: 37.5404, lng: 127.0692, hasPracticeRoom: true },
  { id: "st-nowon", name: "노원", line: "7호선", lat: 37.6545, lng: 127.0615, hasPracticeRoom: true },
  { id: "st-mangwon", name: "망원", line: "6호선", lat: 37.556, lng: 126.9101, hasPracticeRoom: true },
  { id: "st-itrwon", name: "이태원", line: "6호선", lat: 37.5345, lng: 126.9945, hasPracticeRoom: false },
];

export function getStationById(id: string | null | undefined): SubwayStation | undefined {
  if (!id) return undefined;
  return SUBWAY_STATIONS.find((s) => s.id === id);
}

export function getStationsWithPracticeRoom(): SubwayStation[] {
  return SUBWAY_STATIONS.filter((s) => s.hasPracticeRoom);
}

/** 두 좌표의 중간점 */
export function midpoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): { lat: number; lng: number } {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** 극단이 자주 쓰는 기본 연습 거점 */
export const DEFAULT_HUB_STATION_ID = "st-sadang";

/** 중간점에 가장 가까운 연습실 있는 역 N개 (사당역 소폭 가산점) */
export function nearestPracticeStations(
  center: { lat: number; lng: number },
  limit = 5,
  options?: { preferSadang?: boolean },
): SubwayStation[] {
  const preferSadang = options?.preferSadang ?? true;
  return getStationsWithPracticeRoom()
    .map((s) => {
      let dist = distanceKm(center, s);
      // 사당은 자주 쓰는 거점이라 동점이면 우선, 거리도 소폭 보정
      if (preferSadang && s.id === DEFAULT_HUB_STATION_ID) {
        dist = Math.max(0, dist - 1.2);
      }
      return { station: s, dist };
    })
    .sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      if (a.station.id === DEFAULT_HUB_STATION_ID) return -1;
      if (b.station.id === DEFAULT_HUB_STATION_ID) return 1;
      return 0;
    })
    .slice(0, limit)
    .map((x) => x.station);
}
