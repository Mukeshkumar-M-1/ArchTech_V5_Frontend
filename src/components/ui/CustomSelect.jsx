import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, className = "w-48" }) {
  let flattenedOptions = [];
  options.forEach(opt => {
    if (opt.group) {
      flattenedOptions.push(...opt.items);
    } else {
      flattenedOptions.push(opt);
    }
  });

  const selectedOption = flattenedOptions.find(o => (o.value !== undefined ? o.value : o) === value) || value;
  const displayLabel = selectedOption.label !== undefined ? selectedOption.label : (selectedOption.value !== undefined ? selectedOption.value : selectedOption);

  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <div className={`relative ${className} ${open ? 'z-20' : ''}`}>
          <Listbox.Button className="relative w-full cursor-pointer bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-3 pl-4 pr-10 text-left text-xs font-bold uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all hover:border-blue-300">
            <span className="block truncate">{displayLabel}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1 scale-95"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 translate-y-1 scale-95"
          >
            <Listbox.Options className="absolute mt-2 max-h-[350px] w-full overflow-auto rounded-2xl bg-white/95 backdrop-blur-md py-2 text-xs shadow-2xl border border-slate-100 ring-1 ring-slate-900/10 focus:outline-none z-[9999] scrollbar-pro origin-top">
              {options.map((opt, idx) => {
                if (opt.group) {
                  return (
                    <div key={idx}>
                      <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 mt-2 first:mt-0 border-y border-slate-100/50">
                        {opt.group}
                      </div>
                      {opt.items.map(item => (
                        <Listbox.Option
                          key={item.value !== undefined ? item.value : item}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 pl-10 pr-4 transition-colors ${
                              active ? 'bg-blue-50 text-blue-900' : 'text-slate-700'
                            }`
                          }
                          value={item.value !== undefined ? item.value : item}
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? 'font-black text-blue-600' : 'font-bold'}`}>
                                {item.label !== undefined ? item.label : (item.value !== undefined ? item.value : item)}
                              </span>
                              {selected ? (
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                </span>
                              ) : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))}
                    </div>
                  );
                }

                return (
                  <Listbox.Option
                    key={opt.value !== undefined ? opt.value : opt}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-3 pl-10 pr-4 transition-colors ${
                        active ? 'bg-blue-50 text-blue-900' : 'text-slate-700'
                      }`
                    }
                    value={opt.value !== undefined ? opt.value : opt}
                  >
                    {({ selected }) => (
                      <>
                        <span className={`block truncate ${selected ? 'font-black text-blue-600' : 'font-bold'}`}>
                          {opt.label !== undefined ? opt.label : (opt.value !== undefined ? opt.value : opt)}
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                );
              })}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  );
}
