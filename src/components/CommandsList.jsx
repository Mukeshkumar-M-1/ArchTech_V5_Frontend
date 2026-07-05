import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

const CommandsList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = index => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (!event) return false;
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[160px] p-1 animate-in fade-in zoom-in-95 duration-100">
      {props.items.length > 0 ? (
        props.items.map((item, index) => (
          <button
            key={index}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-3 w-full px-3 py-2 text-left rounded-lg transition-all ${
              index === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              index === selectedIndex ? 'border-indigo-200 ' + (item.iconBg || 'bg-white') : 'border-slate-100 ' + (item.iconBg || 'bg-slate-50')
            }`}>
              <span className="text-[13px] font-black leading-none flex items-center justify-center">
                {typeof item.icon === 'string' ? (item.icon || item.title[0]) : item.icon}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black uppercase tracking-tight">{item.title}</span>
              <span className="text-[9px] text-slate-400 font-medium">{item.description}</span>
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-xs text-slate-400 italic">No commands found</div>
      )}
    </div>
  );
});

export default CommandsList;
