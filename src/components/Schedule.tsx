const Schedule = () => {
  const schedule = [
    { day: "Monday", sessions: [{ time: "07:00", class: "Open Mat" }, { time: "12:00", class: "Boxing" }, { time: "19:00", class: "BJJ" }] },
    { day: "Tuesday", sessions: [{ time: "07:00", class: "Conditioning" }, { time: "18:00", class: "Kickboxing" }, { time: "20:00", class: "MMA" }] },
    { day: "Wednesday", sessions: [{ time: "07:00", class: "Open Mat" }, { time: "12:00", class: "BJJ" }, { time: "19:00", class: "Boxing" }] },
    { day: "Thursday", sessions: [{ time: "07:00", class: "Conditioning" }, { time: "18:00", class: "MMA" }, { time: "20:00", class: "Kickboxing" }] },
    { day: "Friday", sessions: [{ time: "07:00", class: "Open Mat" }, { time: "12:00", class: "Boxing" }, { time: "18:00", class: "BJJ" }] },
    { day: "Saturday", sessions: [{ time: "10:00", class: "Open Mat" }, { time: "12:00", class: "Sparring" }] },
    { day: "Sunday", sessions: [{ time: "10:00", class: "Recovery" }] },
  ];

  return (
    <section id="schedule" className="py-32 md:py-40 bg-background">
      <div className="container mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="max-w-xl mb-16">
          <div className="space-y-4 mb-8">
            <div className="section-line" />
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
              Weekly Schedule
            </p>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.1em] leading-tight mb-6">
            Train With Purpose
          </h2>
          <p className="text-muted-foreground font-light leading-relaxed">
            Structured sessions. Consistent rhythm. Your week, organized.
          </p>
        </div>

        {/* Timetable */}
        <div className="border-t border-border">
          {schedule.map((day, index) => (
            <div 
              key={day.day}
              className="grid grid-cols-12 border-b border-border py-6 md:py-8 items-start"
            >
              {/* Day */}
              <div className="col-span-12 md:col-span-2 mb-4 md:mb-0">
                <span className="text-sm tracking-[0.2em] uppercase text-foreground">
                  {day.day}
                </span>
              </div>
              
              {/* Sessions */}
              <div className="col-span-12 md:col-span-10">
                <div className="flex flex-wrap gap-x-12 gap-y-3">
                  {day.sessions.map((session, sessionIndex) => (
                    <div key={sessionIndex} className="flex items-baseline gap-3">
                      <span className="text-xs text-muted-foreground tracking-wider font-light">
                        {session.time}
                      </span>
                      <span className="text-sm text-foreground font-light tracking-wide">
                        {session.class}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-xs text-muted-foreground tracking-wider mt-8 font-light">
          Private sessions available upon request.
        </p>
      </div>
    </section>
  );
};

export default Schedule;
