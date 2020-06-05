import { Request, Response, response } from 'express'
import knex from '../database/connection'

class PointsController {
    async show(req: Request, res: Response) {
        const { id } = req.params;

        const point = await knex('points').where('id', id).first();

        if (!point) {
            return res.status(404).json({ message: 'Point Not Found.' });
        }

        const serializedPoint = {
            ...point,
            image_url: `http://192.168.100.6:5842/uploads/${point.image}`,
        };

        const items = await knex('items')
            .join('point_items', 'items.id', '=', 'point_items.item_id')
            .where('point_items.point_id', id)
            .select('items.title')

        return res.json({ point: serializedPoint, items }); 
    }

    async index(req: Request, res: Response) {
        var { city, uf, items } = req.query;
        if (typeof city == 'undefined') city = '';
        if (typeof uf == 'undefined') uf = '';
        if (typeof items != 'undefined') {
            var parsedItems = String(items)
                .split(',')
                .map(item => Number(item.trim()));
        } else {
            var parsedItems = Array<number>()
        }
        

        const points = await knex('points')
            .modify(function (queryBuilder) {
                if (String(items) != '' && typeof items != 'undefined') {
                    queryBuilder
                        .join('point_items', 'points.id', '=', 'point_items.point_id')
                        .whereIn('point_items.item_id', parsedItems)
                }
            })
            .modify(function (queryBuilder) {
                if (String(city) != '' && typeof city != 'undefined') {
                    queryBuilder.where('city', String(city))
                }
            })
            .modify(function (queryBuilder) {
                if (String(uf) != '' && typeof uf != 'undefined') {
                    queryBuilder.where('uf', String(uf))
                }
            })
            .distinct()
            .select('points.*');
        
        const serializedPoints = points.map(point => {
            return {
                ...point,
                image_url: `http://192.168.100.6:5842/uploads/${point.image}`,
            }
        })
        
        return res.json(serializedPoints);
    }

    async create(req: Request, res: Response) {
        const {
            name,
            email,
            whatsapp,
            latitude,
            longitude,
            city,
            uf,
            items
        } = req.body;

        const trx = await knex.transaction();

        const point = {
            image: req.file.filename,
            name,
            email,
            whatsapp,
            latitude,
            longitude,
            city,
            uf
        };

        trx('points').insert(point).then(insertedIds => {
            const point_id = insertedIds[0];

            const pointItems = items
                .split(',')
                .map((item: string) => Number(item.trim()))
                .map((item_id: Number) => {
                    return { item_id, point_id: point_id }
                })

            trx('point_items').insert(pointItems).then(async () => {
                try {
                    await trx.commit()
                    return res.json({
                        success: true,
                        id: point_id,
                        ...point
                    })
                } catch {
                    await trx.rollback();
                    return res.json({
                        success: false
                    })
                }
                
            }).catch(async () => {
                await trx.rollback();
                return res.json({
                    success: false
                })
            })
        }).catch(async () => {
            await trx.rollback();
            return res.json({
                success: false
            })
        });
    }
}

export default PointsController;