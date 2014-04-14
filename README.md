#mPlane nodeJS reference library

This is the mPlane nodejs library. 
The architecture and software structure is based on [mPlane reference implementation](http://fp7mplane.github.io/protocol-ri/) written in python.

>messages 
>        -> Statement    
>                -> Capability 
>                -> Specification
>                -> Result 
>        -> Notification
>                -> Receipt 
>                -> Redemption 
>                -> Withdrawal  (of a capability)
>                -> Interrupt (of a specification)
>
>

+ Chiedere il formato di esemio di un set con DOW. Non ho capito bene cosa fa con le funzioni e levariabili (_parse_wdayset e unparse)
+ In _dow_label domenica non dovrebbe essere su?
+ Nelle funzioni di when non mi è chiaro a cosa serva tzero

+In node non ho bisogno del dictionary, perche tutto gia in JSON. Ad esempio per la creazione degli oggetti, passo direttamente un json config in cui puo esserci tutto quello che serve, indipendentemente se arriva da un altro omponent o è programmatico.

+ Per noi Schedule è un semplice warkaroud di cron (https://github.com/ncb000gt/node-cron)

def _parse_numset(valstr):
    return set(map(int, valstr.split(SET_SEP))) 
    con map applica la funzione int (trasforma stringa in intero) su tutti gli elementi estratti da split in valstr
    Poi restituisce un oggetto set