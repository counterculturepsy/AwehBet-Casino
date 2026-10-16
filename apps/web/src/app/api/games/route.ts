import {NextResponse} from 'next/server';
import {gameAggregator} from '../../../lib/game-aggregator';

export const dynamic = 'force-dynamic';

/** Lists only games explicitly supplied by the configured authorised aggregator. */
export async function GET(){
  const games=await gameAggregator.listGames();
  return NextResponse.json({games,configured:games.length>0,mode:'demo'},{
    headers:{'Cache-Control':'no-store'},
  });
}
