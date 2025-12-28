import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TimelineEvent {
  id: number;
  event_type: string;
  event_date: string;
  event_title: string;
  description: string;
  article_id: number;
}

export default function TimelinePage() {
  const { data: events, isLoading } = useQuery<TimelineEvent[]>({
    queryKey: ['timeline-events'],
    queryFn: async () => {
      const response = await api.get('/timeline');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!events || events.length === 0) {
    return (
      <div>
        <h1>이벤트 타임라인</h1>
        <div className="card">
          <p>이벤트가 없습니다.</p>
        </div>
      </div>
    );
  }

  const groupedEvents = events.reduce((acc, event) => {
    const date = event.event_date ? format(new Date(event.event_date), 'yyyy-MM-dd') : '날짜 없음';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>이벤트 타임라인</h1>

      <div style={{ position: 'relative', paddingLeft: '2rem' }}>
        {sortedDates.map((date, dateIndex) => (
          <div key={date} style={{ marginBottom: '2rem' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'var(--primary-color)',
                border: '3px solid white',
                boxShadow: '0 0 0 2px var(--primary-color)',
                marginTop: '0.25rem',
              }}
            />
            {dateIndex < sortedDates.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '5.5px',
                  top: '16px',
                  width: '2px',
                  height: 'calc(100% + 1rem)',
                  background: 'var(--border-color)',
                }}
              />
            )}
            <div style={{ marginLeft: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>
                {date === '날짜 없음' ? date : format(new Date(date), 'yyyy년 MM월 dd일', { locale: ko })}
              </h2>
              {groupedEvents[date].map((event) => (
                <div key={event.id} className="card" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <h3>{event.event_title}</h3>
                    <span
                      style={{
                        background: 'var(--bg-color)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      {event.event_type}
                    </span>
                  </div>
                  <p style={{ color: 'var(--secondary-color)' }}>{event.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

