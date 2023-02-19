import { Popover, Card, Button } from "antd";
import { ColumnsType } from "antd/es/table";
import axios from "axios";
import { create, UseBoundStore, StoreApi } from "zustand";



export type StoreType = "peopleStore" | "planetStore" | "vehicleStore" | "speciesStore" | "filmStore" | "starshipStore";

export interface SWBaseAPIRecord {
  created:string;
  edited:string;
  url:string;
}
export interface People extends SWBaseAPIRecord {
  name: string;
  height: string;
  mass: string;
  hair_color: string;
  skin_color: string;
  eye_color: string;
  birth_year: string;
  gender: string;
  homeworld: string;
  films?: (string)[] | null;
  species?: (null)[] | null;
  vehicles?: (string)[] | null;
  starships?: (string)[] | null;
}

export interface Planet  extends SWBaseAPIRecord {
  name: string;
  rotation_period: string;
  orbital_period: string;
  diameter: string;
  climate: string;
  gravity: string;
  terrain: string;
  surface_water: string;
  population: string;
  residents?: (string)[] | null;
  films?: (string)[] | null;
}

export interface Starship  extends SWBaseAPIRecord {
  name: string;
  model: string;
  manufacturer: string;
  cost_in_credits: string;
  length: string;
  max_atmosphering_speed: string;
  crew: string;
  passengers: string;
  cargo_capacity: string;
  consumables: string;
  hyperdrive_rating: string;
  MGLT: string;
  starship_class: string;
  pilots?: (null)[] | null;
  films?: (string)[] | null;
}

export interface Species  extends SWBaseAPIRecord {
  name: string;
  classification: string;
  designation: string;
  average_height: string;
  skin_colors: string;
  hair_colors: string;
  eye_colors: string;
  average_lifespan: string;
  homeworld: string;
  language: string;
  people?: (string)[] | null;
  films?: (string)[] | null;
}

export interface Vehicle extends SWBaseAPIRecord {
  name: string;
  model: string;
  manufacturer: string;
  cost_in_credits: string;
  length: string;
  max_atmosphering_speed: string;
  crew: string;
  passengers: string;
  cargo_capacity: string;
  consumables: string;
  vehicle_class: string;
  pilots?: (null)[] | null;
  films?: (string)[] | null;
}

export interface Film extends SWBaseAPIRecord {
  title: string;
  episode_id: number;
  opening_crawl: string;
  director: string;
  producer: string;
  release_date: string;
  characters?: (string)[] | null;
  planets?: (string)[] | null;
  starships?: (string)[] | null;
  vehicles?: (string)[] | null;
  species?: (string)[] | null;
}


export interface SWStore<T extends SWBaseAPIRecord> 
{
  cache:(T|null|undefined)[];
  maxCount:number;
  add:(item:T, id:number) => void;
  addMultiple:(items:T[]) => void;
  remove:(id:number) => void;
  get:(id:number, forceRetrieve:boolean) => Promise<void>;
  getPage:(pageNumber:number, forceRetrieve:boolean) => Promise<void>;
  previouslyRequestedPages: number[];
  previouslySearchedStrings:string[];
  searchFor:(search:string) => Promise<void>
}

const apiBaseEndpoints = {
  people: "https://swapi.dev/api/people",
  planets: "https://swapi.dev/api/planets",
  starships: "https://swapi.dev/api/starships",
  species: "https://swapi.dev/api/species",
  vehicles: "https://swapi.dev/api/vehicles",
  films: "https://swapi.dev/api/films"
};

// Gets the ID of a record from the url.
// all individual record URLs from this api are of the form
// https://swapi.dev/api/{category}/{id}
// thus, we need only extract the last number from this string to get the record id
export function ExtractID(url:string) 
{
  let match = url.match(/(\d+)(?!.*\d)/);
  if (match) 
  {
    return parseInt(match[0]);
  }
  return -1;
}

function StoreGenerator<T extends SWBaseAPIRecord>(apiBase:string)
{
  // cast this to any to avoid a typing nightmare
  // todo: determine if it's worth the time to learn the intricate typing
  let store = create<T>() as unknown as any;
  
  return store(
    (
      set: (partial: SWStore<T> | Partial<SWStore<T>> | ((state: SWStore<T>) => SWStore<T> | Partial<SWStore<T>>), replace?: boolean | undefined) => void,
      get: () => SWStore<T>
    ) => 
    (
      {
        previouslyRequestedPages: [],
        previouslySearchedStrings: [],
        cache: [],
        maxCount:0,
        add: (item:T, id:number) => set((state) => {
          // create a deep clone of the state to maintain purity
          let mutableState = JSON.parse(JSON.stringify(state)) as SWStore<T>;
          mutableState.cache[id] = item;
          return mutableState;
        }),
        addMultiple: (items:T[]) => set((state) => {
          // create a deep clone of the state to maintain purity
          let mutableState = JSON.parse(JSON.stringify(state)) as SWStore<T>;
          for (let x = 0; x < items.length; x++) {
            let id = ExtractID(items[x].url);
            mutableState.cache[id] = items[x];
          }
          return mutableState;
        }),
        remove: (id:number) => set((state) => {
          // create a deep clone of the state to maintain purity
          let mutableState = JSON.parse(JSON.stringify(state)) as SWStore<T>;
          mutableState.cache[id] = null;
          return mutableState;
        }),
        get: async (id:number, force:boolean) => {
          let store = get();

          //we will first check if this entry already exists in the store.
          //if it does not, we will search for it

          console.log(`${id} requested`);

          if (!store.cache[id] || force) {
            try {
              let response = await axios.get(`${apiBase}/${id}`);

              console.log("Response:",response);

              if (response.data.detail && response.data.detail.toLowerCase() == "Not Found") {
                throw `No record with id ${id} was found!`;
              }

              if (response.data) {
                let item = response.data as T;

                store.add(item,id);
              }
            } catch (error) {
              throw error;
            }
          }
        },
        getPage: async (pageNumber:number, force:boolean) => {
          // our api returns 10 records per page
          // thus, if our array already have members ((pageNumber-1)*10 through pageNumber*10 - 1)
          // we don't need to do another api request
          let store = get();

          if (!force) 
          {
            let canUseLocalCopy = store.previouslyRequestedPages.indexOf(pageNumber) != -1;
            if (canUseLocalCopy) {
              // the store does not need to update
              return;
            }
          }

          try {
            let response = await axios.get(`${apiBase}?page=${pageNumber}`);
            console.log("Page result:",response);
            set((state) => {
              let mutableState = JSON.parse(JSON.stringify(state));
              mutableState.previouslyRequestedPages.push(pageNumber);
              return mutableState;
            });

            if (response.data.results.length > 0) {

              if (store.maxCount != response.data.count) 
              {
                set((state) => {
                  let mutableState = JSON.parse(JSON.stringify(state)) as SWStore<T>;
                  mutableState.maxCount = response.data.count;
                  if (!mutableState.cache[mutableState.maxCount-1]) {
                    mutableState.cache[mutableState.maxCount-1] = null;
                  }
                  return mutableState;
                });
              }

              let items = response.data.results as T[];

              store.addMultiple(items);
            }
          } catch (error) {
            throw error;
          }
        },
        searchFor: async (search:string) => {
          // we don't need to waste any resources if the string is null, undefined, or empty
          if (!search) { return; }
          let store = get();

          if (store.maxCount > 0) {
            let nonNullRecordCount = store.cache.filter(r => !!r).length;

            if (nonNullRecordCount >= store.maxCount - 1) {
              // we don't need to run a search because our data set is already full
              return;
            }
          }

          if (store.previouslySearchedStrings.indexOf(search) != -1) {
            // we have already run this query. We don't need to run it again.
            // Refreshing the page will allow it to be run again.
            return;
          }
          try {
            let result:T[] = [];
            let response = await axios.get(`${apiBase}/?search=${search}`);

            (response.data.results as T[]).forEach(r => result.push(r));
            while (response && response.data && response.data.next) 
            {
              response = await axios.get(response.data.next);
              (response.data.results as T[]).forEach(r => result.push(r));
            }
            
            store.addMultiple(result);

          } catch (error) {
            throw error;
          }
        }
      } as SWStore<T>
    )
  ) as any as UseBoundStore<StoreApi<SWStore<T>>>;
}

const usePeopleStore = StoreGenerator<People>(apiBaseEndpoints.people);
const usePlanetStore = StoreGenerator<Planet>(apiBaseEndpoints.planets);
const useStarshipStore = StoreGenerator<Starship>(apiBaseEndpoints.starships);
const useSpeciesStore = StoreGenerator<Species>(apiBaseEndpoints.species);
const useVehiclesStore = StoreGenerator<Vehicle>(apiBaseEndpoints.vehicles);
const useFilmsStore = StoreGenerator<Film>(apiBaseEndpoints.films);


export const useStarWarsStores = () => {
  const peopleStore = usePeopleStore();
  const planetStore = usePlanetStore();
  const starshipStore = useStarshipStore();
  const speciesStore = useSpeciesStore();
  const vehicleStore = useVehiclesStore();
  const filmStore = useFilmsStore();

  return {
    peopleStore, planetStore, starshipStore, speciesStore, vehicleStore, filmStore
  }
}

export function FilterStoreData(data:any[], filter:string = "", filterFields:string[] = [],deletedIDs:number[] = [], focusedIDs:number[] = [], removeNullUndefinedEmpty?:boolean) 
{
  //NOTE: consider using immer.js for better immutability handling
  let dataCopy = JSON.parse(JSON.stringify(data)) as any[];

  //remove empties
  if (removeNullUndefinedEmpty) 
  {
    dataCopy = dataCopy.filter((d) => !(d == null || d == undefined || d == ""));
  }

  //remove deleted
  for (let x = 0; x < dataCopy.length; x++) 
  {
    let record = dataCopy[x];
    let index = deletedIDs.indexOf(ExtractID(record.url));
    if (index == -1) {
      // the record ID is not in the deletedID array
    } else {
      dataCopy.splice(x,1);
      x--;
      continue;
    }
  }

  //remove NOT focused, if we have any focused
  if (focusedIDs.length > 0) {
    for (let x = 0; x < dataCopy.length; x++) {
      let record = dataCopy[x];
      let index = focusedIDs.indexOf(ExtractID(record.url));
      if (index == -1) {
        // the record ID is NOT being focused. Remove from array
        dataCopy.splice(x,1);
        x--;
        continue;
      } else {
        // the record IS is focused. Keep it in the array.
      }
    }
  }

  
  if (filter == undefined || filter == null || filter == "") 
  {
    return dataCopy;
  }

  //filter by string
  for (let x = 0; x < dataCopy.length; x++) 
  {
    let record = dataCopy[x];
    for (let key of filterFields) {
      if (Object.hasOwn(record,key)) {
        let fieldData = record[key];
        if (typeof(fieldData) != "string") {continue;}
        //the data has the field that is filterable
        //we want to remove this record if the field doesn't match the filter
        let index = fieldData.toLowerCase().indexOf(filter);
        if (index == -1) {
          // filter was not found on this field
          dataCopy.splice(x,1);
          x--;
          continue;
        }
      }
    }
  }

  return dataCopy;
}

const peopleColumns:ColumnsType<People> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    render: (text) => <b>{text}</b>,
    sorter: (a,b) => a.name < b.name ? -1 : 1
  },
  {
    title: "Born",
    dataIndex: "birth_year",
    key: "birth_year",
  },
  {
    title: "Height",
    dataIndex: "height",
    key: "height",
    sorter: (a,b) => parseFloat(a.height) < parseFloat(b.height) ? 1 : -1,
  },
  {
    title: "Mass",
    dataIndex: "mass",
    key: "mass",
    sorter: (a,b) => parseFloat(a.mass) < parseFloat(b.mass) ? 1 : -1
  },
  {
    title: "Hair",
    dataIndex: "hair_color",
    key: "hair_color",
    sorter: (a,b) => (a.hair_color) < (b.hair_color) ? 1 : -1
  },
  {
    title: "Skin",
    dataIndex: "skin_color",
    key: "skin_color",
    sorter: (a,b) => (a.skin_color) < (b.skin_color) ? 1 : -1
  },
  {
    title: "Eyes",
    dataIndex: "eye_color",
    key: "eye_color",
    sorter: (a,b) => (a.eye_color) < (b.eye_color) ? 1 : -1
  },
  {
    title: "Gender",
    dataIndex: "gender",
    key: "gender",
    sorter: (a,b) => (a.gender) < (b.gender) ? 1 : -1
  }
]
const filmColumns:ColumnsType<Film> = [
  {
    title: "Name",
    dataIndex: "title",
    key: "title",
    render: (text) => <h3>{text}</h3>,
    sorter: (a,b) => a.title < b.title ? -1 : 1,
  },
  {
    title: "Episode",
    dataIndex: "episode_id",
    key: "episode_id",
    sorter: (a,b) => a.episode_id < b.episode_id ? -1 : 1,
  },
  {
    title: "Opening",
    dataIndex: "opening_crawl",
    key: "opening_crawl",
    render: (text) => <>
      <Popover content={<Card>{text}</Card>} title="Opening Crawl" trigger="click">
        <Button onClick={(e) => e.stopPropagation() } type="link">Details</Button>
      </Popover>
    </>
  },
  {
    title: "Director",
    dataIndex: "director",
    key: "director",
    sorter: (a,b) => a.director < b.director ? -1 : 1
  },
  {
    title: "Producer",
    dataIndex: "producer",
    key: "producer",
    sorter: (a,b) => a.producer < b.producer ? -1 : 1
  },
  {
    title: "Released",
    dataIndex: "release_data",
    key: "release_data",
    render: (text, record) => {
      
      return <>
        <label>{record.release_date}</label>
      </>
    },
    sorter: (a,b) => {
      let d0 = new Date(a.release_date);
      let d1 = new Date(a.release_date);

      return d0 < d1 ? -1 : 1;
    }
  }
]
const planetColumns:ColumnsType<Planet> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    render: (text) => <b>{text}</b>,
    sorter: (a,b) => a.name < b.name ? -1 : 1
  },
  {
    title: "Diameter",
    dataIndex: "diameter",
    key: "diameter",
    sorter: (a,b) => parseFloat(a.diameter) < parseFloat(b.diameter) ? -1 : 1
  },
  {
    title: "Rotation Period",
    dataIndex: "rotation_period",
    key: "rotation_period",
    sorter: (a,b) => parseFloat(a.rotation_period) < parseFloat(b.rotation_period) ? -1 : 1
  },
  {
    title: "Orbital Period",
    dataIndex: "orbital_period",
    key: "orbital_period ",
    sorter: (a,b) => parseFloat(a.orbital_period )< parseFloat(b.orbital_period) ? -1 : 1
  },
  {
    title: "Gravity",
    dataIndex: "gravity",
    key: "gravity",
    sorter: (a,b) => parseFloat(a.gravity) < parseFloat(b.gravity) ? -1 : 1
  },
  {
    title: "Population",
    dataIndex: "population",
    key: "population",
    sorter: (a,b) => parseFloat(a.population) < parseFloat(b.population) ? -1 : 1
  },
  {
    title: "Surface Water",
    dataIndex: "surface_water",
    key: "surface_water",
    sorter: (a,b) => parseFloat(a.surface_water) < parseFloat(b.surface_water) ? -1 : 1
  },
  {
    title: "Climate",
    dataIndex: "climate",
    key: "climate",
    sorter: (a,b) => a.climate < b.climate ? -1 : 1
  },
  {
    title: "Terrain",
    dataIndex: "terrain",
    key: "terrain",
    sorter: (a,b) => a.terrain < b.terrain ? -1 : 1
  }

]
const speciesColumns:ColumnsType<Species> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    sorter: (a,b) => a.name < b.name ? -1 : 1
  },
  {
    title: "Class",
    dataIndex: "classification",
    key: "classification"
  },
  {
    title: "Designation",
    dataIndex: "designation",
    key: "designation",
  },
  {
    title: "Avg Height",
    dataIndex: "average_height",
    key: "average_height",
  },
  {
    title: "Avg Lifespan",
    dataIndex: "average_lifespawn",
    key: "average_lifespan",
  },
  {
    title: "Eye Colors",
    dataIndex: "eye_colors",
    key: "eye_colors",
    render: (text,record,index) => {
      return <>
        <Popover content={
          <>
            {
              record.eye_colors.split(",").map(c => <div>{c}</div>)
            }
          </>
        } title={`${record.name} eye colors`} 
          trigger="click"
        >
          <Button onClick={(e) => e.stopPropagation() } type="link">Details</Button>
        </Popover>
        
      </>
    }
  },
  {
    title: "Hair Colors",
    dataIndex: "hair_colors",
    key: "hair_colors",
    render: (text,record,index) => {
      return <>
        <Popover content={
          <>
            {
              record.hair_colors.split(",").map(c => <div>{c}</div>)
            }
          </>
        } title={`${record.name} hair colors`} 
          trigger="click"
        >
          <Button onClick={(e) => e.stopPropagation() } type="link">Details</Button>
        </Popover>
        
      </>
    }
  },
  {
    title: "Skin Colors",
    dataIndex: "skin_colors",
    key: "skin_colors",
    render: (text,record,index) => {
      return <>
        <Popover content={
          <>
            {
              record.skin_colors.split(",").map(c => <div>{c}</div>)
            }
          </>
        } title={`${record.name} skin colors`} 
          trigger="click"
        >
          <Button onClick={(e) => e.stopPropagation() } type="link">Details</Button>
        </Popover>
        
      </>
    }
  },
  {
    title: "Language",
    dataIndex: "language",
    key: "language"
  }
]
const starshipColumns:ColumnsType<Starship> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    sorter: (a,b) => a.name < b.name ? -1 : 1
  },
  {
    title: "Model",
    dataIndex: "model",
    key: "model",
    sorter: (a,b) => a.name < b.name ? -1 : 1
  },
  {
    title: "Class",
    dataIndex: "starship_class",
    key: "starship_class",
    sorter: (a,b) => a.name < b.name ? -1 : 1
  },
  {
    title: "Manufacturer",
    dataIndex:"manufacturer",
    key:"manufacturer",
    sorter: (a,b) => a.name < b.name ? -1 : 1
  },
  {
    title: "Cost",
    dataIndex:"cost_in_credits",
    key: "cost_in_credits",
    sorter: (a,b) => parseFloat(a.cost_in_credits) < parseFloat(b.cost_in_credits) ? -1 : 1
  },
  {
    title: "Length",
    dataIndex: "length",
    key: "length",
    sorter: (a,b) => parseFloat(a.length) < parseFloat(b.length) ? -1 : 1
  },
  {
    title: "Crew",
    dataIndex: "crew",
    key: "crew",
    sorter: (a,b) => parseFloat(a.crew) < parseFloat(b.crew) ? -1 : 1
  },
  {
    title: "Passengers",
    dataIndex: "passengers",
    key: "passengers",
    sorter: (a,b) => parseFloat(a.passengers) < parseFloat(b.passengers) ? -1 : 1
  },
  {
    title: "Atmosphering Speed",
    dataIndex: "max_atmosphering_speed",
    key: "max_atmosphering_speed",
    sorter: (a,b) => parseFloat(a.max_atmosphering_speed) < parseFloat(b.max_atmosphering_speed) ? -1 : 1
  },
  {
    title: "Hyperdrive Rating",
    dataIndex: "hyperdrive_rating",
    key: "hyperdrive_rating",
    sorter: (a,b) => a.hyperdrive_rating < b.hyperdrive_rating ? -1 : 1
  },
  {
    title: "MGLT",
    dataIndex: "MGLT",
    key: "MGLT",
    sorter: (a,b) => parseFloat(a.MGLT) < parseFloat(b.MGLT) ? -1 : 1
  },
  {
    title: "Cargo Capacity",
    dataIndex: "cargo_capacity",
    key: "cargo_capacity",
    sorter: (a,b) => parseFloat(a.cargo_capacity) < parseFloat(b.cargo_capacity) ? -1 : 1
  },
  {
    title: "Consumable Duration",
    dataIndex: "consumables",
    key: "consumables",
    sorter: (a,b) => parseFloat(a.consumables) < parseFloat(b.consumables) ? -1 : 1
  }

]
const vehicleColumns:ColumnsType<Vehicle> = [
  {
    title: "Name",
    dataIndex: "name",
    key:"name",
    sorter: (a,b) => (a.name) < (b.name) ? -1 : 1
  },
  {
    title:"Model",
    dataIndex:"model",
    key:"model",
    sorter: (a,b) => (a.model) < (b.model) ? -1 : 1
  },
  {
    title:"Class",
    dataIndex:"vehicle_class",
    key:"vehicle_class",
    sorter: (a,b) => (a.vehicle_class) < (b.vehicle_class) ? -1 : 1
  },
  {
    title: "Manufacturer",
    dataIndex:"manufacturer",
    key:"manufacturer",
    sorter: (a,b) => a.manufacturer < b.manufacturer ? -1 : 1
  },
  {
    title: "Cost",
    dataIndex:"cost_in_credits",
    key: "cost_in_credits",
    sorter: (a,b) => parseFloat(a.cost_in_credits) < parseFloat(b.cost_in_credits) ? -1 : 1
  },
  {
    title: "Length",
    dataIndex: "length",
    key: "length",
    sorter: (a,b) => parseFloat(a.length) < parseFloat(b.length) ? -1 : 1
  },
  {
    title: "Crew",
    dataIndex: "crew",
    key: "crew",
    sorter: (a,b) => parseFloat(a.crew) < parseFloat(b.crew) ? -1 : 1
  },
  {
    title: "Passengers",
    dataIndex: "passengers",
    key: "passengers",
    sorter: (a,b) => parseFloat(a.passengers) < parseFloat(b.passengers) ? -1 : 1
  },
  {
    title: "Atmosphering Speed",
    dataIndex: "max_atmosphering_speed",
    key: "max_atmosphering_speed",
    sorter: (a,b) => parseFloat(a.max_atmosphering_speed) < parseFloat(b.max_atmosphering_speed) ? -1 : 1
  },
  {
    title: "Cargo Capacity",
    dataIndex: "cargo_capacity",
    key: "cargo_capacity",
    sorter: (a,b) => parseFloat(a.cargo_capacity) < parseFloat(b.cargo_capacity) ? -1 : 1
  },
  {
    title: "Consumable Duration",
    dataIndex: "consumables",
    key: "consumables",
    sorter: (a,b) => parseFloat(a.consumables) < parseFloat(b.consumables) ? -1 : 1
  }
  
]
export const GetColumnsImmutable = (category:StoreType) =>
{
  let immutableColumns = peopleColumns as any;
  switch (category) {
    case "peopleStore":
      immutableColumns = peopleColumns;
      break;
    case "filmStore":
      immutableColumns = filmColumns;
      break;
    case "planetStore":
      immutableColumns = planetColumns;
      break;
    case "speciesStore":
      immutableColumns = speciesColumns;
      break;
    case "starshipStore":
      immutableColumns = starshipColumns;
      break;
    case "vehicleStore":
      immutableColumns = vehicleColumns;
      break;
  }

  let clone:any = [];
  for (let x = 0; x < immutableColumns.length; x++) {
    let colData = immutableColumns[x] as any[];
    clone.push({...colData});
  }

  return clone;
}